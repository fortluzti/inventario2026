<?php
/**
 * Validator — Whitelist de campos + validacao de tipos (anti-mass-assignment).
 * Regras: ['tipo' => 'int|string|date|decimal|email', 'req' => bool, 'max' => int]
 */
declare(strict_types=1);

final class Validator
{
    /**
     * Retorna apenas os campos permitidos, ja validados/coagidos.
     * Erros de validacao sao lancados como ValidationException.
     */
    public static function filter(array $input, array $rules): array
    {
        $clean = [];
        $errors = [];

        foreach ($rules as $field => $rule) {
            $present = array_key_exists($field, $input);
            $value = $present ? $input[$field] : null;

            if (!$present || $value === null || $value === '') {
                if (!empty($rule['req'])) {
                    $errors[$field] = 'Campo obrigatorio.';
                } else {
                    $clean[$field] = null;
                }
                continue;
            }

            switch ($rule['tipo']) {
                case 'int':
                    if (!preg_match('/^-?\d+$/', (string)$value)) {
                        $errors[$field] = 'Deve ser um numero inteiro.';
                        continue 2;
                    }
                    $clean[$field] = (int)$value;
                    break;
                case 'decimal':
                    if (!is_numeric($value)) {
                        $errors[$field] = 'Deve ser um numero.';
                        continue 2;
                    }
                    $clean[$field] = (float)$value;
                    break;
                case 'date':
                    $d = DateTime::createFromFormat('Y-m-d', (string)$value);
                    if (!$d || $d->format('Y-m-d') !== $value) {
                        $errors[$field] = 'Data invalida (use YYYY-MM-DD).';
                        continue 2;
                    }
                    $clean[$field] = $value;
                    break;
                case 'email':
                    if (!filter_var($value, FILTER_VALIDATE_EMAIL)) {
                        $errors[$field] = 'E-mail invalido.';
                        continue 2;
                    }
                    $clean[$field] = (string)$value;
                    break;
                default: // string
                    $clean[$field] = trim((string)$value);
                    $max = (int)($rule['max'] ?? 255);
                    if (mb_strlen($clean[$field]) > $max) {
                        $errors[$field] = "Maximo de {$max} caracteres.";
                        continue 2;
                    }
                    // Evita chars de controle / tentativa de header injection
                    $clean[$field] = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $clean[$field]);
            }
        }

        if ($errors !== []) {
            throw new ValidationException($errors);
        }
        return $clean;
    }
}

final class ValidationException extends RuntimeException
{
    public function __construct(public readonly array $errors)
    {
        parent::__construct('Erros de validacao.');
    }
}
