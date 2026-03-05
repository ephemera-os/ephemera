import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('AI OAuth chat PHP compatibility hardening', () => {
    it('guards set_time_limit for restrictive shared hosts', () => {
        const source = readFileSync(resolve(process.cwd(), 'public/api/ai-oauth/chat.php'), 'utf8');
        const setTimeLimitGuardBlock = source.match(
            /if\s*\(([\s\S]*?)\)\s*\{\s*@set_time_limit\(AI_CHATGPT_RESPONSES_TIMEOUT_SECONDS \+ 5\);\s*\}/
        );

        expect(setTimeLimitGuardBlock?.[1] || '').toContain("function_exists('set_time_limit')");
    });
});
