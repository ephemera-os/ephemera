import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

function loadCodeSource() {
    const testFilePath = fileURLToPath(import.meta.url);
    const repoRoot = path.resolve(path.dirname(testFilePath), '..');
    return readFileSync(path.join(repoRoot, 'js/apps/code.js'), 'utf8');
}

describe('Code editor git UI integration', () => {
    it('contains source control sidebar and git status controls', () => {
        const source = loadCodeSource();

        expect(source).toContain('sidebar-tab-source-${windowId}');
        expect(source).toContain('source-clone-url-${windowId}');
        expect(source).toContain('source-clone-target-${windowId}');
        expect(source).toContain('source-clone-${windowId}');
        expect(source).toContain('source-oauth-status-${windowId}');
        expect(source).toContain('source-oauth-connect-${windowId}');
        expect(source).toContain('source-oauth-disconnect-${windowId}');
        expect(source).toContain('source-stage-all-${windowId}');
        expect(source).toContain('source-commit-msg-${windowId}');
        expect(source).toContain('git-branch-select-${windowId}');
        expect(source).toContain('git-pull-${windowId}');
        expect(source).toContain('git-push-${windowId}');
    });

    it('renders file tree git indicators and diff gutter markers', () => {
        const source = loadCodeSource();

        expect(source).toContain('.git-indicator');
        expect(source).toContain("'git-diff-gutter'");
        expect(source).toContain('.git-diff-marker.added');
        expect(source).toContain('.git-diff-marker.removed');
    });

    it('wires source control actions to EphemeraGit APIs', () => {
        const source = loadCodeSource();

        expect(source).toContain('window.EphemeraGit.stageAll');
        expect(source).toContain('window.EphemeraGit.stageFile');
        expect(source).toContain('window.EphemeraGit.unstageFile');
        expect(source).toContain('window.EphemeraGit.commit');
        expect(source).toContain('window.EphemeraGit.checkout');
        expect(source).toContain('window.EphemeraGit.clone');
        expect(source).toContain('window.EphemeraGit.pull');
        expect(source).toContain('window.EphemeraGit.push');
        expect(source).toContain('window.EphemeraOAuth.connectGitHub');
        expect(source).toContain('window.EphemeraOAuth.disconnectGitHub');
    });
});
