package hypersheet

import (
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"time"
)

// LogLevel represents the severity of a log entry
type LogLevel int

const (
	DebugLevel LogLevel = iota
	InfoLevel
	NoticeLevel
	WarningLevel
	ErrorLevel
	CriticalLevel
)

func (l LogLevel) String() string {
	switch l {
	case DebugLevel:
		return "debug"
	case InfoLevel:
		return "info"
	case NoticeLevel:
		return "notice"
	case WarningLevel:
		return "warning"
	case ErrorLevel:
		return "error"
	case CriticalLevel:
		return "critical"
	default:
		return "unknown"
	}
}

// CasbinLogger provides optional logging for Casbin authorization decisions
type CasbinLogger struct {
	mu       sync.Mutex
	enabled  bool
	level    LogLevel
	logFile  string
	handlers []string
	logger   *log.Logger
}

// NewCasbinLogger creates a new Casbin logger. Set enabled=false to disable.
func NewCasbinLogger(config map[string]string) *CasbinLogger {
	cl := &CasbinLogger{
		enabled:  config["enabled"] == "true",
		level:    parseLevel(config["min_level"]),
		logFile:  config["log_file"],
		handlers: strings.Split(config["handlers"], ","),
	}

	if cl.logFile == "" {
		cl.logFile = "/tmp/Hypersheet_casbin.log"
	}
	if len(cl.handlers) == 0 || cl.handlers[0] == "" {
		cl.handlers = []string{"file"}
	}

	if cl.enabled {
		f, err := os.OpenFile(cl.logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if err == nil {
			cl.logger = log.New(f, "", 0)
		}
	}

	return cl
}

func parseLevel(s string) LogLevel {
	switch strings.ToLower(s) {
	case "debug":
		return DebugLevel
	case "info":
		return InfoLevel
	case "notice":
		return NoticeLevel
	case "warning":
		return WarningLevel
	case "error":
		return ErrorLevel
	case "critical":
		return CriticalLevel
	default:
		return InfoLevel
	}
}

func (cl *CasbinLogger) shouldLog(level LogLevel) bool {
	return cl.enabled && level >= cl.level
}

func (cl *CasbinLogger) write(level LogLevel, msg string, ctx map[string]interface{}) {
	if !cl.shouldLog(level) {
		return
	}

	cl.mu.Lock()
	defer cl.mu.Unlock()

	timestamp := time.Now().Format("2006-01-02 15:04:05.000")
	ctxStr := ""
	if len(ctx) > 0 {
		ctxStr = " " + fmt.Sprintf("%v", ctx)
	}
	entry := fmt.Sprintf("[%s] [Hypersheet.casbin.%s] %s%s\n", timestamp, level, msg, ctxStr)

	for _, h := range cl.handlers {
		switch strings.TrimSpace(h) {
		case "file":
			if cl.logger != nil {
				cl.logger.Print(entry)
			}
		case "stdout":
			fmt.Print(entry)
		case "stderr":
			fmt.Fprint(os.Stderr, entry)
		}
	}
}

// Debug logs at debug level
func (cl *CasbinLogger) Debug(msg string, ctx map[string]interface{}) {
	cl.write(DebugLevel, msg, ctx)
}

// Info logs at info level
func (cl *CasbinLogger) Info(msg string, ctx map[string]interface{}) {
	cl.write(InfoLevel, msg, ctx)
}

// Warning logs at warning level
func (cl *CasbinLogger) Warning(msg string, ctx map[string]interface{}) {
	cl.write(WarningLevel, msg, ctx)
}

// Error logs at error level
func (cl *CasbinLogger) Error(msg string, ctx map[string]interface{}) {
	cl.write(ErrorLevel, msg, ctx)
}

// LogEnforce logs an authorization decision
func (cl *CasbinLogger) LogEnforce(userID, object, action string, allowed bool) {
	level := InfoLevel
	if !allowed {
		level = WarningLevel
	}
	cl.write(level, "Enforce decision", map[string]interface{}{
		"user":    userID,
		"object":  object,
		"action":  action,
		"allowed": allowed,
	})
}

// LogCellAccess logs a cell-level access check
func (cl *CasbinLogger) LogCellAccess(userID, colName, action string, granted bool) {
	level := DebugLevel
	if !granted {
		level = WarningLevel
	}
	cl.write(level, "Cell access check", map[string]interface{}{
		"user":    userID,
		"column":  colName,
		"action":  action,
		"granted": granted,
	})
}

// Close flushes and closes the log file
func (cl *CasbinLogger) Close() {
	cl.enabled = false
}
