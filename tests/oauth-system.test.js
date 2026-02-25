import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eventsMock, sessionStorageMock, stateMock } from './setup.js';

import '../js/system/oauth.js';

const EphemeraOAuth = window.EphemeraOAuth;

describe('EphemeraOAuth', () => {
    beforeEach(() => {
        eventsMock._reset();
        sessionStorageMock._reset();
        stateMock._reset();
        fetch.mockReset();

        if (window.history?.replaceState) {
            window.history.replaceState({}, '', '/');
        }

        window.EphemeraStorage = {
            get: vi.fn(async () => null),
            put: vi.fn(async () => true)
        };

        EphemeraOAuth._resetForTests();
    });

    it('creates a GitHub PKCE authorization URL and stores pending verifier/state', async () => {
        EphemeraOAuth.setGithubClientId('Iv1.testclientid');

        const authUrl = await EphemeraOAuth.connectGitHub({
            scopes: ['repo', 'read:user'],
            dryRun: true
        });

        expect(authUrl).toContain('https://github.com/login/oauth/authorize?');
        expect(authUrl).toContain('client_id=Iv1.testclientid');
        expect(authUrl).toContain('code_challenge_method=S256');

        const pendingRaw = sessionStorage.getItem('ephemera_oauth_github_pending');
        const pending = JSON.parse(pendingRaw);
        expect(pending.provider).toBe('github');
        expect(typeof pending.state).toBe('string');
        expect(typeof pending.verifier).toBe('string');
        expect(pending.state.length).toBeGreaterThan(10);
        expect(pending.verifier.length).toBeGreaterThan(20);
    });

    it('handles GitHub callback exchange and exposes auth for github remotes', async () => {
        sessionStorage.setItem('ephemera_oauth_github_pending', JSON.stringify({
            provider: 'github',
            state: 'state-123',
            verifier: 'verifier-123',
            scopes: ['repo', 'read:user'],
            redirectUri: 'http://localhost:3000/',
            clientId: 'Iv1.testclientid',
            createdAt: Date.now()
        }));
        EphemeraOAuth.setGithubClientId('Iv1.testclientid');

        const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
        window.history.replaceState({}, '', '/?code=oauth-code-abc&state=state-123');
        replaceStateSpy.mockClear();

        fetch
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    access_token: 'gho_live_token',
                    token_type: 'bearer',
                    scope: 'repo,read:user'
                })
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    id: 1,
                    login: 'octocat',
                    name: 'Octo Cat'
                })
            });

        await EphemeraOAuth.init({ force: true });

        const gitAuth = await EphemeraOAuth.getGitAuthForUrl('https://github.com/octo/private-repo.git');
        expect(gitAuth).toEqual({
            username: 'x-access-token',
            password: 'gho_live_token'
        });

        expect(window.EphemeraStorage.put).toHaveBeenCalledWith(
            'metadata',
            expect.objectContaining({
                key: 'oauth_tokens'
            })
        );
        expect(replaceStateSpy).toHaveBeenCalledTimes(1);
        expect(EphemeraOAuth.getStatus().github.connected).toBe(true);
    });

    it('disconnects GitHub OAuth and clears stored Git credentials', async () => {
        window.EphemeraStorage.get.mockResolvedValue({
            key: 'oauth_tokens',
            value: {
                github: {
                    accessToken: 'gho_cached_token',
                    tokenType: 'bearer',
                    scope: 'repo',
                    createdAt: Date.now()
                }
            }
        });

        await EphemeraOAuth.init({ force: true });
        expect(await EphemeraOAuth.getGitAuthForUrl('https://github.com/example/repo.git')).toEqual({
            username: 'x-access-token',
            password: 'gho_cached_token'
        });

        await EphemeraOAuth.disconnectGitHub();
        expect(await EphemeraOAuth.getGitAuthForUrl('https://github.com/example/repo.git')).toBe(null);
        expect(window.EphemeraStorage.put).toHaveBeenCalledWith(
            'metadata',
            expect.objectContaining({
                key: 'oauth_tokens',
                value: {
                    github: null
                }
            })
        );
    });
});
