<?php

namespace Hypersheet;

use Psr\Log\LogLevel;

class CasbinLogger
{
    private bool $enabled;
    private string $logFile;
    private string $minLevel;
    private array $handlers;
    private static array $levels = [
        'debug' => 0,
        'info' => 1,
        'notice' => 2,
        'warning' => 3,
        'error' => 4,
        'critical' => 5,
    ];

    public function __construct(array $config = [])
    {
        $this->enabled = $config['enabled'] ?? false;
        $this->logFile = $config['log_file'] ?? sys_get_temp_dir() . '/Hypersheet_casbin.log';
        $this->minLevel = $config['min_level'] ?? 'info';
        $this->handlers = $config['handlers'] ?? ['file'];

        if ($this->enabled) {
            $dir = dirname($this->logFile);
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
        }
    }

    private function shouldLog(string $level): bool
    {
        $min = self::$levels[$this->minLevel] ?? 1;
        $current = self::$levels[$level] ?? 0;
        return $this->enabled && $current >= $min;
    }

    private function log(string $level, string $message, array $context = []): void
    {
        if (!$this->shouldLog($level)) return;

        $timestamp = date('Y-m-d H:i:s.v');
        $contextStr = !empty($context) ? ' ' . json_encode($context, JSON_UNESCAPED_UNICODE) : '';
        $entry = "[{$timestamp}] [Hypersheet.casbin.{$level}] {$message}{$contextStr}" . PHP_EOL;

        foreach ($this->handlers as $handler) {
            match ($handler) {
                'file' => file_put_contents($this->logFile, $entry, FILE_APPEND | LOCK_EX),
                'stdout' => fwrite(STDOUT, $entry),
                'stderr' => fwrite(STDERR, $entry),
                default => null,
            };
        }
    }

    public function debug(string $message, array $context = []): void
    {
        $this->log('debug', $message, $context);
    }

    public function info(string $message, array $context = []): void
    {
        $this->log('info', $message, $context);
    }

    public function warning(string $message, array $context = []): void
    {
        $this->log('warning', $message, $context);
    }

    public function error(string $message, array $context = []): void
    {
        $this->log('error', $message, $context);
    }

    // Casbin integration helpers
    public function logEnforce(string $userId, string $object, string $action, bool $allowed): void
    {
        $level = $allowed ? 'info' : 'warning';
        $this->log($level, 'Enforce decision', [
            'user' => $userId,
            'object' => $object,
            'action' => $action,
            'allowed' => $allowed,
        ]);
    }

    public function logCellAccess(string $userId, string $colName, string $action, bool $granted): void
    {
        $level = $granted ? 'debug' : 'warning';
        $this->log($level, 'Cell access check', [
            'user' => $userId,
            'column' => $colName,
            'action' => $action,
            'granted' => $granted,
        ]);
    }
}
