package setupapp

import (
	"strings"

	"charm.land/lipgloss/v2"
)

// Window manager for the workbench. Manages floating inspector windows (Layer 2)
// and modal dialogs (Layer 3) on top of the tiled base (Layer 1).
//
// Built on lipgloss v2 Compositor: each window is a Layer with an ID, position,
// z-order, and content string. The Compositor provides native hit-testing
// (Hit(x,y) → top window ID) and z-sorted rendering.
//
// The base layout (conversation/ledger/approval/composer) is NOT a floating
// layer — it's rendered as the base string and the Compositor floats on top.

type windowTier int

const (
	tierFloat windowTier = 100 // Layer 2: floating inspectors
	tierModal windowTier = 200 // Layer 3: modal dialogs (input-grabbing)
)

// windowKind identifies which inspector a window is.
type windowKind string

const (
	winPolicy   windowKind = "policy"
	winLease    windowKind = "lease"
	winCapsules windowKind = "capsules"
	winTrace    windowKind = "trace"
	winUsage    windowKind = "usage"
	winModal    windowKind = "modal"
)

// window is one floating/modal window in the workbench.
type window struct {
	id     string
	kind   windowKind
	tier   windowTier
	title  string
	x      int
	y      int
	width  int
	height int
	// content is re-rendered on each frame from the current model state.
	content  string
	scrolled int // scroll offset within content
}

// windowManager owns the open windows, focus state, and drag state.
type windowManager struct {
	windows  []*window
	focused  string // id of the focused window
	dragging string // id of the window being dragged ("" if none)
	dragX    int
	dragY    int
}

func newWindowManager() *windowManager {
	return &windowManager{}
}

// open creates or refreshes a window of the given kind. If a window of this
// kind already exists, its content is updated and it's focused; otherwise a new
// window is created and focused.
func (wm *windowManager) open(kind windowKind, title, content string, w, h int) {
	// Refresh existing window of same kind.
	for _, win := range wm.windows {
		if win.kind == kind {
			win.content = content
			win.width = w
			win.height = h
			wm.focus(win.id)
			return
		}
	}
	id := string(kind) + "_" + randomID()
	win := &window{
		id:      id,
		kind:    kind,
		tier:    tierFloat,
		title:   title,
		x:       -1, // centered later in layout
		y:       -1,
		width:   w,
		height:  h,
		content: content,
	}
	wm.windows = append(wm.windows, win)
	wm.focus(id)
}

// openModal opens a modal window (Layer 3, input-grabbing). Only one modal at
// a time — opening a new one replaces any existing modal.
func (wm *windowManager) openModal(id, title, content string, w, h int) {
	// Remove any existing modal.
	wm.closeModals()
	win := &window{
		id:      id,
		kind:    winModal,
		tier:    tierModal,
		title:   title,
		x:       -1,
		y:       -1,
		width:   w,
		height:  h,
		content: content,
	}
	wm.windows = append(wm.windows, win)
	wm.focus(id)
}

// focus raises the window to the top of its tier and sets it as focused.
func (wm *windowManager) focus(id string) {
	wm.focused = id
	maxZ := 0
	for _, win := range wm.windows {
		if int(win.tier) > maxZ {
			maxZ = int(win.tier)
		}
	}
	// Bump the focused window's z above all others in its tier.
	// (The Compositor handles actual z-order; we just track focus here.)
}

// close removes the window with the given id.
func (wm *windowManager) close(id string) {
	out := wm.windows[:0]
	for _, win := range wm.windows {
		if win.id != id {
			out = append(out, win)
		}
	}
	wm.windows = out
	if wm.focused == id {
		wm.focused = ""
		if len(wm.windows) > 0 {
			wm.focused = wm.windows[len(wm.windows)-1].id
		}
	}
}

// closeTop closes the highest-z window (Esc behavior). Returns true if a window
// was closed.
func (wm *windowManager) closeTop() bool {
	if len(wm.windows) == 0 {
		return false
	}
	// Find the highest-tier window; within a tier, the last opened is topmost.
	bestIdx := -1
	bestTier := windowTier(0)
	for i, win := range wm.windows {
		if win.tier >= bestTier {
			bestTier = win.tier
			bestIdx = i
		}
	}
	if bestIdx >= 0 {
		wm.close(wm.windows[bestIdx].id)
		return true
	}
	return false
}

// closeModals removes all modal windows.
func (wm *windowManager) closeModals() {
	out := wm.windows[:0]
	for _, win := range wm.windows {
		if win.tier != tierModal {
			out = append(out, win)
		}
	}
	wm.windows = out
	if wm.focused == "" && len(wm.windows) > 0 {
		wm.focused = wm.windows[len(wm.windows)-1].id
	}
}

// hasModal returns true if any modal is open (input should be grabbed).
func (wm *windowManager) hasModal() bool {
	for _, win := range wm.windows {
		if win.tier == tierModal {
			return true
		}
	}
	return false
}

// cycleFocus advances focus to the next floating window (Tab behavior).
func (wm *windowManager) cycleFocus() {
	if len(wm.windows) == 0 {
		return
	}
	// Only cycle among non-modal windows.
	var floats []*window
	for _, win := range wm.windows {
		if win.tier == tierFloat {
			floats = append(floats, win)
		}
	}
	if len(floats) == 0 {
		return
	}
	idx := 0
	for i, win := range floats {
		if win.id == wm.focused {
			idx = (i + 1) % len(floats)
			break
		}
	}
	wm.focused = floats[idx].id
}

// hit returns the window at (x, y), or nil. Called on mouse clicks for focus
// routing. Uses simple bounding-box check against each window's position+size.
// (The Compositor.Hit could be used, but since we manage positions ourselves
// and the base layout isn't a layer, a manual hit-test is more reliable.)
func (wm *windowManager) hit(x, y int) *window {
	// Check topmost-first: iterate in reverse z order.
	for i := len(wm.windows) - 1; i >= 0; i-- {
		win := wm.windows[i]
		if win.x < 0 || win.y < 0 {
			continue // not yet positioned
		}
		if x >= win.x && x < win.x+win.width &&
			y >= win.y && y < win.y+win.height {
			return win
		}
	}
	return nil
}

// beginDrag starts dragging a window if (x,y) is in its title bar.
func (wm *windowManager) beginDrag(x, y int) bool {
	win := wm.hit(x, y)
	if win == nil || win.tier == tierModal {
		return false
	}
	// Title bar is the first line (y == win.y).
	if y == win.y {
		wm.dragging = win.id
		wm.dragX = x
		wm.dragY = y
		wm.focus(win.id)
		return true
	}
	wm.focus(win.id)
	return false
}

// dragMove translates the dragged window by the mouse delta.
func (wm *windowManager) dragMove(x, y, maxW, maxH int) {
	if wm.dragging == "" {
		return
	}
	for _, win := range wm.windows {
		if win.id == wm.dragging {
			dx := x - wm.dragX
			dy := y - wm.dragY
			win.x = clampInt(win.x+dx, 0, maxInt(0, maxW-win.width))
			win.y = clampInt(win.y+dy, 0, maxInt(0, maxH-win.height))
			wm.dragX = x
			wm.dragY = y
			return
		}
	}
}

// endDrag stops the current drag.
func (wm *windowManager) endDrag() {
	wm.dragging = ""
}

// positionWindows centers any unpositioned windows (x/y == -1).
func (wm *windowManager) positionWindows(termW, termH int) {
	for _, win := range wm.windows {
		if win.x < 0 {
			win.x = maxInt(0, (termW-win.width)/2)
		}
		if win.y < 0 {
			win.y = maxInt(0, (termH-win.height)/2-2)
		}
	}
}

// renderWindows returns a Compositor-rendered string of all floating/modal
// windows composited on top of the base content. If no windows are open, it
// returns the base unchanged.
func (wm *windowManager) renderWindows(base string, termW, termH int) string {
	if len(wm.windows) == 0 {
		return base
	}
	wm.positionWindows(termW, termH)

	// Build layers: base is the root, each window is a child Layer.
	root := lipgloss.NewLayer(base)
	var layers []*lipgloss.Layer
	for _, win := range wm.windows {
		content := wm.renderWindowContent(win)
		layer := lipgloss.NewLayer(content).
			ID(win.id).
			X(win.x).
			Y(win.y).
			Z(int(win.tier))
		layers = append(layers, layer)
	}
	root.AddLayers(layers...)
	comp := lipgloss.NewCompositor(root)
	return comp.Render()
}

// renderWindowContent renders a single window with a title bar (title + × close),
// border, and body. Focused windows get a gold double border; blurred get gray.
func (wm *windowManager) renderWindowContent(win *window) string {
	theme := styles()
	isFocused := win.id == wm.focused

	// Title bar: centered title + × in the top-right.
	titleColor := lipgloss.Color("#45475A")
	if isFocused {
		titleColor = lipgloss.Color("#FFD700")
	}
	titleStyled := lipgloss.NewStyle().Bold(true).Foreground(titleColor).Render(" " + win.title + " ")
	closeStyled := lipgloss.NewStyle().Foreground(lipgloss.Color("#F38BA8")).Render(" × ")

	// Pad the title bar to fill the width.
	titleBarWidth := win.width - 2 // border chars on each side
	titleLen := lipgloss.Width(titleStyled)
	closeLen := lipgloss.Width(closeStyled)
	padLen := titleBarWidth - titleLen - closeLen
	if padLen < 0 {
		padLen = 0
	}
	titleBar := titleStyled + strings.Repeat(" ", padLen) + closeStyled

	// Body content below the title bar.
	bodyContent := win.content
	fullContent := lipgloss.JoinVertical(lipgloss.Left, titleBar, bodyContent)

	borderStyle := theme.floatBlurred
	if isFocused {
		borderStyle = theme.floatFocused
	}
	return borderStyle.Width(win.width).Height(win.height).Render(fullContent)
}

// updateContent refreshes the content of a window of the given kind.
func (wm *windowManager) updateContent(kind windowKind, content string) {
	for _, win := range wm.windows {
		if win.kind == kind {
			win.content = content
			return
		}
	}
}

var windowIDCounter int

func randomID() string {
	windowIDCounter++
	// itoaSimple is defined in tree.go (shared helper)
	return "w" + itoaSimple(windowIDCounter)
}
