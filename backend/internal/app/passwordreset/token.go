package passwordreset

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
)

// rawTokenLen is the byte length of the random token sent by email.
// 32 bytes = 256 bits of entropy; enough that guessing one within the
// 1-hour lifetime is computationally infeasible.
const rawTokenLen = 32

// GenerateRawToken returns a fresh cryptographically-random token
// (hex-encoded) plus its sha256 hash. The raw form is the one the
// caller embeds in the email; the hash is what gets stored in the DB.
// Splitting this responsibility here keeps the storage layer dumb —
// the DB never sees the raw token, so a leak only yields hashes.
func GenerateRawToken() (raw string, hash string, err error) {
	b := make([]byte, rawTokenLen)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}
	raw = hex.EncodeToString(b)
	hash = HashToken(raw)
	return raw, hash, nil
}

// HashToken returns the sha256 hex digest of the raw token. Stable so
// callers can compute it on lookup (consume path) without storing the
// raw value.
func HashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
