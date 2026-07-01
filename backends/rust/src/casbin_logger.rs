use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;
use std::sync::Mutex;

/// Log level enum for Casbin authorization logging
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum LogLevel {
    Debug = 0,
    Info = 1,
    Notice = 2,
    Warning = 3,
    Error = 4,
    Critical = 5,
}

impl LogLevel {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "debug" => LogLevel::Debug,
            "info" => LogLevel::Info,
            "notice" => LogLevel::Notice,
            "warning" => LogLevel::Warning,
            "error" => LogLevel::Error,
            "critical" => LogLevel::Critical,
            _ => LogLevel::Info,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            LogLevel::Debug => "debug",
            LogLevel::Info => "info",
            LogLevel::Notice => "notice",
            LogLevel::Warning => "warning",
            LogLevel::Error => "error",
            LogLevel::Critical => "critical",
        }
    }
}

/// Optional Casbin authorization logger for HyperGrid
pub struct CasbinLogger {
    enabled: bool,
    min_level: LogLevel,
    log_file: String,
    handlers: Vec<String>,
    file: Mutex<Option<std::fs::File>>,
}

impl CasbinLogger {
    /// Create a new CasbinLogger. Disabled by default.
    ///
    /// Config keys:
    ///   - enabled: "true"/"false"
    ///   - min_level: "debug", "info", "warning", "error", "critical"
    ///   - log_file: path to log file
    ///   - handlers: comma-separated "file,stdout,stderr"
    pub fn new(config: &std::collections::HashMap<String, String>) -> Self {
        let enabled = config.get("enabled").map(|v| v == "true").unwrap_or(false);
        let min_level = config
            .get("min_level")
            .map(|s| LogLevel::from_str(s))
            .unwrap_or(LogLevel::Info);
        let log_file = config
            .get("log_file")
            .cloned()
            .unwrap_or_else(|| "/tmp/hypergrid_casbin.log".to_string());
        let handlers: Vec<String> = config
            .get("handlers")
            .map(|s| s.split(',').map(|h| h.trim().to_string()).collect())
            .unwrap_or_else(|| vec!["file".to_string()]);

        let file = Mutex::new(if enabled {
            if let Some(parent) = Path::new(&log_file).parent() {
                fs::create_dir_all(parent).ok();
            }
            OpenOptions::new()
                .create(true)
                .append(true)
                .open(&log_file)
                .ok()
        } else {
            None
        });

        CasbinLogger {
            enabled,
            min_level,
            log_file,
            handlers,
            file,
        }
    }

    fn should_log(&self, level: LogLevel) -> bool {
        self.enabled && level >= self.min_level
    }

    fn write(&self, level: LogLevel, message: &str, context: Option<&serde_json::Value>) {
        if !self.should_log(level) {
            return;
        }

        let timestamp = chrono_hack::now();
        let ctx_str = match context {
            Some(v) => format!(" {}", v),
            None => String::new(),
        };
        let entry = format!(
            "[{}] [hypergrid.casbin.{}] {}{}\n",
            timestamp, level.as_str(), message, ctx_str
        );

        for handler in &self.handlers {
            match handler.as_str() {
                "file" => {
                    if let Ok(mut file) = self.file.lock() {
                        if let Some(ref mut f) = *file {
                            writeln!(f, "{}", entry.trim()).ok();
                        }
                    }
                }
                "stdout" => {
                    print!("{}", entry);
                }
                "stderr" => {
                    eprint!("{}", entry);
                }
                _ => {}
            }
        }
    }

    /// Log a debug message
    pub fn debug(&self, message: &str, context: Option<&serde_json::Value>) {
        self.write(LogLevel::Debug, message, context);
    }

    /// Log an info message
    pub fn info(&self, message: &str, context: Option<&serde_json::Value>) {
        self.write(LogLevel::Info, message, context);
    }

    /// Log a warning message
    pub fn warning(&self, message: &str, context: Option<&serde_json::Value>) {
        self.write(LogLevel::Warning, message, context);
    }

    /// Log an error message
    pub fn error(&self, message: &str, context: Option<&serde_json::Value>) {
        self.write(LogLevel::Error, message, context);
    }

    /// Log an enforce decision
    pub fn log_enforce(&self, user_id: &str, object: &str, action: &str, allowed: bool) {
        let level = if allowed { LogLevel::Info } else { LogLevel::Warning };
        let ctx = serde_json::json!({
            "user": user_id,
            "object": object,
            "action": action,
            "allowed": allowed,
        });
        self.write(level, "Enforce decision", Some(&ctx));
    }

    /// Log a cell access check
    pub fn log_cell_access(&self, user_id: &str, col_name: &str, action: &str, granted: bool) {
        let level = if granted { LogLevel::Debug } else { LogLevel::Warning };
        let ctx = serde_json::json!({
            "user": user_id,
            "column": col_name,
            "action": action,
            "granted": granted,
        });
        self.write(level, "Cell access check", Some(&ctx));
    }
}

// Simple chrono-like timestamp for no-std/lightweight usage
mod chrono_hack {
    use std::time::{SystemTime, UNIX_EPOCH};

    pub fn now() -> String {
        let dur = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default();
        let secs = dur.as_secs();
        let millis = dur.subsec_millis();

        // Simple UTC formatting without chrono dependency
        let days = secs / 86400;
        let time_secs = secs % 86400;
        let hours = time_secs / 3600;
        let minutes = (time_secs % 3600) / 60;
        let seconds = time_secs % 60;

        // Approximate date from days since epoch (1970-01-01)
        let (year, month, day) = days_to_date(days as i64);

        format!(
            "{:04}-{:02}-{:02} {:02}:{:02}:{:02}.{:03}",
            year, month, day, hours, minutes, seconds, millis
        )
    }

    fn days_to_date(mut days: i64) -> (i64, i64, i64) {
        // From http://howardhinnant.github.io/date_algorithms.html
        days += 719468;
        let era = if days >= 0 { days } else { days - 146096 } / 146097;
        let doe = days - era * 146097;
        let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
        let y = yoe + era * 400;
        let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        let mp = (5 * doy + 2) / 153;
        let d = doy - (153 * mp + 2) / 5 + 1;
        let m = if mp < 10 { mp + 3 } else { mp - 9 };
        (y + if m <= 2 { 1 } else { 0 }, m, d)
    }
}
