<?php
/**
 * Audit — Log de auditoria (quem, o que, quando, IP).
 * Salva em arquivo JSON-lines (rotation diaria) e ignora falhas silenciosamente.
 */
declare(strict_types=1);

final class Audit
{
    public static function log(PDO $pdo, ?int $apiKeyId, string $action, string $endpoint, ?int $recordId, array $context = []): void
    {
        try {
            $stmt = $pdo->prepare(
                'INSERT INTO audit_log (api_key_id, endpoint, record_id, action, ip, user_agent, context, criado_em)
                 VALUES (:k, :e, :r, :a, :ip, :ua, :ctx, NOW())'
            );
            $stmt->execute([
                ':k'   => $apiKeyId,
                ':e'   => $endpoint,
                ':r'   => $recordId,
                ':a'   => $action,
                ':ip'  => self::clientIp(),
                ':ua'  => substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
                ':ctx' => json_encode($context, JSON_UNESCAPED_UNICODE),
            ]);
        } catch (Throwable $e) {
            // Nao derrubar a requisicao por falha de auditoria; registrar em error_log.
            error_log('[apiphp][audit] ' . $e->getMessage());
        }
    }

    public static function clientIp(): string
    {
        // Nao confiamos em X-Forwarded-For por padrao (spoof). Ajuste se houver proxy confiavel.
        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }
}
