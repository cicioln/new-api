package muse

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	musesdk "github.com/CoolkHz/muse-protocol-go/muse"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

// Image requests accept the same optional fields as common Muse image APIs:
// images (reference image URLs in a JSON body), style, negative_prompt, and
// response_format "url".

type imageExtras struct {
	style       string
	negative    string
	aspectRatio string
}

func rawString(raw json.RawMessage) string {
	var text string
	if len(raw) > 0 && common.Unmarshal(raw, &text) == nil {
		return strings.TrimSpace(text)
	}
	return ""
}

func imageExtrasOf(c *gin.Context, request *dto.ImageRequest) imageExtras {
	extras := imageExtras{
		style:       rawString(request.Style),
		negative:    rawString(request.Extra["negative_prompt"]),
		aspectRatio: rawString(request.Extra["aspect_ratio"]),
	}
	if form := c.Request.MultipartForm; form != nil {
		if values := form.Value["aspect_ratio"]; extras.aspectRatio == "" && len(values) > 0 {
			extras.aspectRatio = strings.TrimSpace(values[0])
		}
		if values := form.Value["style"]; extras.style == "" && len(values) > 0 {
			extras.style = strings.TrimSpace(values[0])
		}
		if values := form.Value["negative_prompt"]; extras.negative == "" && len(values) > 0 {
			extras.negative = strings.TrimSpace(values[0])
		}
	}
	return extras
}

// jsonImageRefs loads reference images given as URLs or data URLs in a JSON
// body, in images (strings or {"url"}/{"image_url"} objects) or image.
func jsonImageRefs(c *gin.Context, request *dto.ImageRequest) ([]musesdk.RefImage, error) {
	if c.Request.MultipartForm != nil {
		return nil, nil
	}
	var sources []string
	collect := func(raw json.RawMessage) {
		if len(raw) == 0 {
			return
		}
		var one string
		if common.Unmarshal(raw, &one) == nil {
			sources = append(sources, one)
			return
		}
		var list []json.RawMessage
		if common.Unmarshal(raw, &list) != nil {
			return
		}
		for _, item := range list {
			if common.Unmarshal(item, &one) == nil {
				sources = append(sources, one)
				continue
			}
			var object struct {
				URL      string          `json:"url"`
				ImageURL json.RawMessage `json:"image_url"`
			}
			if common.Unmarshal(item, &object) != nil {
				continue
			}
			if object.URL != "" {
				sources = append(sources, object.URL)
			} else if nested := rawString(object.ImageURL); nested != "" {
				sources = append(sources, nested)
			} else {
				var inner struct {
					URL string `json:"url"`
				}
				if common.Unmarshal(object.ImageURL, &inner) == nil && inner.URL != "" {
					sources = append(sources, inner.URL)
				}
			}
		}
	}
	collect(request.Images)
	collect(request.Image)
	if len(sources) > musesdk.MaxRefImages {
		return nil, fmt.Errorf("at most %d reference images are supported", musesdk.MaxRefImages)
	}
	refs := make([]musesdk.RefImage, 0, len(sources))
	for _, source := range sources {
		source = strings.TrimSpace(source)
		if source == "" {
			continue
		}
		data, mime, err := service.GetBase64Data(c, types.NewFileSourceFromData(source, ""), "muse_image_reference")
		if err != nil {
			return nil, fmt.Errorf("load reference image failed: %w", err)
		}
		raw, err := base64.StdEncoding.DecodeString(data)
		if err != nil {
			return nil, fmt.Errorf("decode reference image failed: %w", err)
		}
		if len(raw) == 0 || len(raw) > musesdk.MaxRefImageBytes {
			return nil, fmt.Errorf("reference image exceeds %d bytes", musesdk.MaxRefImageBytes)
		}
		refs = append(refs, musesdk.RefImage{Data: raw, Mime: mime})
	}
	return refs, nil
}

// Images returned with response_format "url" are kept for publicImageTTL and
// served from a signed link, so the link itself is the credential.

const publicImageTTL = 7 * 24 * time.Hour

var publicImagePattern = regexp.MustCompile(`^img-[0-9a-f]{32}\.(png|jpg|webp|gif)$`)

func publicImageDir() string {
	return filepath.Join(engineConfig.MediaDir(), "public")
}

func publishImage(c *gin.Context, path string) (string, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	ext := ".png"
	switch http.DetectContentType(raw) {
	case "image/jpeg":
		ext = ".jpg"
	case "image/webp":
		ext = ".webp"
	case "image/gif":
		ext = ".gif"
	}
	key := make([]byte, 16)
	if _, err := rand.Read(key); err != nil {
		return "", err
	}
	name := "img-" + hex.EncodeToString(key) + ext
	if err := os.MkdirAll(publicImageDir(), 0o755); err != nil {
		return "", err
	}
	if err := os.WriteFile(filepath.Join(publicImageDir(), name), raw, 0o644); err != nil {
		return "", err
	}
	access, err := service.IssueTaskArtifactAccess(name, name)
	if err != nil {
		return "", err
	}
	return publicBaseURL(c) + "/muse/media/" + access + "/" + name, nil
}

func publicBaseURL(c *gin.Context) string {
	if address := strings.TrimRight(strings.TrimSpace(system_setting.ServerAddress), "/"); address != "" && !strings.Contains(address, "localhost") {
		return address
	}
	scheme := strings.TrimSpace(strings.Split(c.GetHeader("X-Forwarded-Proto"), ",")[0])
	if scheme == "" {
		scheme = "http"
		if c.Request.TLS != nil {
			scheme = "https"
		}
	}
	host := strings.TrimSpace(strings.Split(c.GetHeader("X-Forwarded-Host"), ",")[0])
	if host == "" {
		host = c.Request.Host
	}
	return scheme + "://" + host
}

// ServePublicImage serves an image published by publishImage.
func ServePublicImage(c *gin.Context) {
	sharedEngine() // initializes engineConfig, which locates the media dir
	name := c.Param("name")
	if !publicImagePattern.MatchString(name) || !service.VerifyTaskArtifactAccess(c.Param("access"), name, name) {
		c.Status(http.StatusNotFound)
		return
	}
	path := filepath.Join(publicImageDir(), name)
	info, err := os.Stat(path)
	if err != nil || time.Since(info.ModTime()) > publicImageTTL {
		c.Status(http.StatusNotFound)
		return
	}
	c.Header("Cache-Control", "public, max-age=86400, immutable")
	c.Header("Content-Security-Policy", "sandbox; default-src 'none'")
	c.Header("X-Content-Type-Options", "nosniff")
	c.File(path)
}

func removeExpiredPublicImages() {
	entries, err := os.ReadDir(publicImageDir())
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			common.SysError(common.LogText("muse: read public image dir failed: %s", err.Error()))
		}
		return
	}
	cutoff := time.Now().Add(-publicImageTTL)
	for _, entry := range entries {
		if entry.IsDir() || !publicImagePattern.MatchString(entry.Name()) {
			continue
		}
		if info, err := entry.Info(); err == nil && info.ModTime().Before(cutoff) {
			_ = os.Remove(filepath.Join(publicImageDir(), entry.Name()))
		}
	}
}
