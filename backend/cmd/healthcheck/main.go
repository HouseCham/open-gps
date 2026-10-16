// Command healthcheck is the container probe for the API: it GETs the
// readiness endpoint and exits 0 (ready) or 1 (not ready). The runtime
// image is distroless (no shell, no curl), so compose/kubernetes exec
// probes need this binary.
package main

import (
	"flag"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"
)

func main() {
	port := os.Getenv("API_PORT")
	if _, err := strconv.ParseUint(port, 10, 64); err != nil {
		port = "8080"
	}
	url := flag.String("url", "http://127.0.0.1:"+port+"/health/ready", "readiness URL")
	timeout := flag.Duration("timeout", 2*time.Second, "request timeout")
	flag.Parse()

	client := &http.Client{Timeout: *timeout}
	resp, err := client.Get(*url)
	if err != nil {
		fmt.Fprintln(os.Stderr, "healthcheck:", err)
		os.Exit(1)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		fmt.Fprintln(os.Stderr, "healthcheck: unexpected status", resp.Status)
		os.Exit(1)
	}
}
