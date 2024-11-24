package main

import (
	"context"
	"database/sql"
	_ "embed"
	"encoding/json"
	"flag"
	"fmt"
	"html/template"
	"log"
	"log/slog"
	"math"

	// "math/rand/v2"
	"os"
	"regexp"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"

	apibsky "github.com/bluesky-social/indigo/api/bsky"
	"github.com/bluesky-social/jetstream/pkg/client"
	"github.com/bluesky-social/jetstream/pkg/client/schedulers/sequential"
	"github.com/bluesky-social/jetstream/pkg/models"
)

const (
	serverAddr = "wss://jetstream1.us-east.bsky.network/subscribe"
)

//go:embed "template.html"
var t string
var tpl = template.Must(template.New("").Parse(t))

var loc *time.Location

func main() {
	ny, err := time.LoadLocation("America/New_York")
	if err != nil {
		log.Fatal(err)
	}
	loc = ny
	ctx := context.Background()
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level:     slog.LevelInfo,
		AddSource: true,
	})))
	logger := slog.Default()

	var fileOut, dbFile string
	flag.StringVar(&fileOut, "file", "out.html", "the html file path to write")
	flag.StringVar(&dbFile, "db", "feelslike.db", "the db file path to write")
	flag.Parse()

	hw, err := NewHistoryWriter(dbFile)
	if err != nil {
		log.Fatal(err)
	}

	config := client.DefaultClientConfig()
	config.WebsocketURL = serverAddr
	config.Compress = true
	config.WantedCollections = []string{"app.bsky.feed.post"}

	now := time.Now().In(loc)
	current := NewWeek()

	// replay anything from the database
	for _, hl := range hw.LastLines {
		if now.Format(timeLayout) == hl.Date.Format(timeLayout) {
			current = hl.Week
		}
	}

	h := &handler{
		CurrentDays: current,
		Today: now,
		HistoryWriter: hw,
	}
	scheduler := sequential.NewScheduler("jetstream_localdev", logger, h.HandleEvent)

	c, err := client.NewClient(config, logger, scheduler)
	if err != nil {
		log.Fatalf("failed to create client: %v", err)
	}

	cursor := time.Now().Add(5 * -time.Minute).UnixMicro()


	write := func() {
		f, err := os.Create(fileOut)
		defer f.Close()
		if err != nil {
			log.Println(err)
			return
		}
		if err := tpl.Execute(f, h); err != nil {
			log.Println(err)
		}
	}
	write()

	// // Every 5 seconds print the events read and bytes read and average event size
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		for {
			select {
			case <-ticker.C:
				write()
				// eventsRead := c.EventsRead.Load()
				// bytesRead := c.BytesRead.Load()
				// avgEventSize := bytesRead / eventsRead
				// logger.Info("stats", "events_read", eventsRead, "bytes_read", bytesRead, "avg_event_size", avgEventSize)
			}
		}
	}()

	if err := c.ConnectAndRead(ctx, &cursor); err != nil {
		log.Fatalf("failed to connect: %v", err)
	}

	slog.Info("shutdown")
}

var days = []string{"sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"}
var likeDay = regexp.MustCompile("feels like[^\\.,\\!]*("+ strings.Join(days, "|") + ")")

func match(text string) (bool, string) {
	lowered := strings.ToLower(text)
	feelsLikeIndex := strings.Index(lowered, "today feels like")
	if feelsLikeIndex > -1 {
		match := likeDay.FindStringSubmatch(lowered)
		foundDay := ""
		if len(match) > 0 {
			found := len(match[0])
			for _, day := range days {
				maybeFound := strings.Index(match[0], day)
				if maybeFound > -1 && maybeFound < found {
					found = maybeFound
					foundDay = day
				}
			}
		}
		return foundDay != "", foundDay
	}
	return false, ""
}

type Week map[int]int64

func NewWeek() *Week {
	w := Week(make(map[int]int64))
	for i := range days {
		w[i] = 0
	}
	return &w
}

func (w Week) Increment(dayName string) {
	for i, d := range days {
		if d == dayName {
			w[i] += 1
			return
		}
	}
}

func (w Week) Max() string {
	lastMax := int64(-1)
	lastDay := ""
	for d, count := range w {
		if count > lastMax {
			lastDay = days[d]
			lastMax = count
		}
	}
	return strings.Title(lastDay)
}


func near(y float64, tys []float64) float64 {
	target := y
	for _, anotherY := range tys {
		if math.Abs(anotherY - target) < 20 {
			target += 20
		}
	}
	return target
}

func (w Week) SVG() any {
	width := 700
	height := 440
	centerX := float64(width / 2)
	centerY := float64(height / 2)
	radius := float64(160)
	lineSweep := 0
	var paths []any
	var total int64
	for _, count := range w {
		total += count
	}
	var sum float64
	var labelYs []float64
	for i := range days {
		count := w[i]
		angle := twoPi * float64(count) / float64(total)
		angleOffset := (sum / float64(total)) * twoPi
		angleHalf := angleOffset + (angle / 2)
		// fmt.Println("i, angle, half, full", i, angleOffset, angleHalf, angleOffset + angle)
		// fmt.Println("i, angle", i, angle)
		// fmt.Println("i, half", i, angleHalf)
		if total == 0 {
			angle = 0
			angleHalf = 0
			angleOffset = 0
		}
		sum += float64(count)
		startX, startY := toDecartTranslate(angleOffset, radius, centerX, centerY)
		labelX, labelY := toDecartTranslate(angleHalf, radius + 40, centerX, centerY)
		if angleHalf > math.Pi {
			labelX = centerX - radius - 40
		} else {
			labelX = centerX + radius + 40
		}
		labelY = near(labelY, labelYs)
		labelYs = append(labelYs, labelY)
		pieLabelX, pieLabelY := toDecartTranslate(angleHalf, (radius / 2), centerX, centerY)
		endX, endY := toDecartTranslate(angleOffset+angle, radius, centerX, centerY)
		path := fmt.Sprintf(
			"M %v %v L %v %v A %v %v 0 %v 1 %v %v Z",
			centerX, centerY,
			startX, startY,
			radius, radius,
			lineSweep,
			endX, endY)

		labelPathX1, labelPathY1 := toDecartTranslate(angleHalf, radius - 10, centerX, centerY)
		labelPathX2, _ := toDecartTranslate(angleHalf, radius + 10, centerX, centerY)
		labelXEnd := labelX - 20
		if angleHalf > math.Pi {
			labelXEnd = labelX + 20
		}
		labelPath := fmt.Sprintf(
			"%v,%v %v,%v %v,%v",
			labelPathX1, labelPathY1,
			labelPathX2, labelY,
			labelXEnd, labelY,
		)
		labelAnchor := "start"
		if angleHalf > math.Pi {
			labelAnchor = "end"
		}

		pct := (float64(count) / float64(total)) * 100
		if total == 0 {
			pct = 0
		}
		var circle any
		if pct == 100 {
			circle = map[string]any{
				"Radius": radius,
				"CX": centerX,
				"CY": centerY,
			}
		}
		paths = append(paths, map[string]any{
			"Empty": total != 0 && pct == 0,
			"Circle": circle,
			"Day": fmt.Sprintf("%s (%.0f%%)", strings.Title(days[i]),  pct),
			"Count": count,
			"LabelTransform": fmt.Sprintf("translate(%v, %v)", labelX, labelY),
			"LabelAnchor": labelAnchor,
			"PieLabelTransform": fmt.Sprintf("translate(%v, %v)", pieLabelX, pieLabelY),
			"Path": path,
			"LabelPath": labelPath,
		})
	}
	return map[string]any{
		"Width": width,
		"Height": height,
		"Paths": paths,
	}
}

type handler struct {
	CurrentDays *Week
	Today time.Time
	HistoryWriter HistoryWriter
}

const (
	twoPi float64 = math.Pi * 2
)

// toDecart converts polar coordinate to the Decard system with inverted Y-axis and start in left-top corner
func toDecart(angle, radius float64) (x, y float64) {
	return math.Sin(angle) * radius, -(math.Cos(angle) * radius)
}

// toDecartTranslate converts polar coordinate to the Decard system with inverted Y-axis and start in left-top corner
// and translated using dx and dy coordinates
func toDecartTranslate(angle, radius, dx, dy float64) (ex, ey float64) {
	sx, sy := toDecart(angle, radius)
	return sx + dx, sy + dy
}

func (h *handler) Now() time.Time {
	return time.Now().In(loc)
}

func (h *handler) HandleEvent(ctx context.Context, event *models.Event) error {
	now := time.Now().In(loc)
	if h.Today.Day() != now.Day() {
		h.Today = now
		h.CurrentDays = NewWeek()
	}
	if event.Commit != nil && (event.Commit.Operation == models.CommitOperationCreate || event.Commit.Operation == models.CommitOperationUpdate) {
		switch event.Commit.Collection {
		case "app.bsky.feed.post":
			var post apibsky.FeedPost
			if err := json.Unmarshal(event.Commit.Record, &post); err != nil {
				return fmt.Errorf("failed to unmarshal post: %w", err)
			}
			matched, day := match(post.Text)
			if matched {
				h.CurrentDays.Increment(day)
				fmt.Printf("%v |(%s)| %s\n", time.UnixMicro(event.TimeUS).Local().Format("15:04:05"), event.Did, post.Text)
				if err := h.HistoryWriter.Upsert(now, h.CurrentDays); err != nil {
					log.Println(err)
				}
			}
		}
	}
	return nil
}

type HistoryLine struct {
	Date time.Time
	Week *Week
}

type HistoryWriter struct {
	db *sql.DB
	LastLines []HistoryLine
}
const timeLayout = "2006-01-02"

func NewHistoryWriter(fileName string) (HistoryWriter, error) {
	db, err := sql.Open("sqlite3", fileName)
	if err != nil {
		return HistoryWriter{}, err
	}
	if _, err := db.Exec("CREATE TABLE IF NOT EXISTS todayfeelslike (date text PRIMARY KEY, sunday integer, monday integer, tuesday integer, wednesday integer, thursday integer, friday integer, saturday integer)"); err != nil {
		return HistoryWriter{}, err
	}
	if _, err := db.Exec("CREATE INDEX IF NOT EXISTS idx_date_key ON todayfeelslike (date);"); err != nil {
		return HistoryWriter{}, err
	}
	rows, err := db.Query("SELECT date, sunday, monday, tuesday, wednesday, thursday, friday, saturday FROM todayfeelslike ORDER BY date DESC LIMIT 5")
	if err != nil {
		return HistoryWriter{}, err
	}
	var lastLines []HistoryLine
	for rows.Next() {
		var date string
		var sunday, monday, tuesday, wednesday, thursday, friday, saturday int64
		if err := rows.Scan(&date, &sunday, &monday, &tuesday, &wednesday, &thursday, &friday, &saturday); err != nil {
			return HistoryWriter{}, err
		}
		d, err := time.ParseInLocation(timeLayout, date, loc)
		if err != nil {
			return HistoryWriter{}, err
		}
		week := Week(map[int]int64{
			0: sunday,
			1: monday,
			2: tuesday,
			3: wednesday,
			4: thursday,
			5: friday,
			6: saturday,
		})
		lastLines = append(lastLines, HistoryLine{
			Date: d.In(loc),
			Week: &week,
		})
	}

	return HistoryWriter{
		db: db,
		LastLines: lastLines,
	}, nil
}

func (h *HistoryWriter) Upsert(now time.Time, w *Week) error {
	asMap := map[int]int64(*w)
	if _, err := h.db.Exec(`INSERT INTO todayfeelslike (date, sunday, monday, tuesday, wednesday, thursday, friday, saturday) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
	ON CONFLICT(date) DO UPDATE SET sunday = ?2, monday = ?3, tuesday = ?4, wednesday = ?5, thursday = ?6, friday = ?7, saturday = ?8
	`,
		now.Format(timeLayout),
		asMap[0],
		asMap[1],
		asMap[2],
		asMap[3],
		asMap[4],
		asMap[5],
		asMap[6],
	); err != nil {
		return err
	}
	newLines := []HistoryLine{
		HistoryLine{
			Date: now,
			Week: w,
		},			
	}
	if len(h.LastLines) > 0 {
		if h.LastLines[0].Date.Equal(now) {
			h.LastLines[0].Week = w
			newLines = h.LastLines
		} else {
			for i, line := range h.LastLines {
				if i >= 4 {
					break
				}
				newLines = append(newLines, line)
			}
		}
	}
	h.LastLines = newLines
	return nil
}

