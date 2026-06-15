package main

import (
	"fmt"
	"os"

	"github.com/XXY-CH/Aetherion/packages/tui-go/setupapp"
)

func main() {
	cfg, err := setupapp.DecodeConfig(os.Stdin)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ether setup tui: %v\n", err)
		os.Exit(1)
	}
	if err := setupapp.Run(cfg, os.Stdout); err != nil {
		fmt.Fprintf(os.Stderr, "ether setup tui: %v\n", err)
		os.Exit(1)
	}
}
