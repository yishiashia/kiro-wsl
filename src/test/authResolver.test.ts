import { expect } from 'chai';
import { RemoteWSLResolver } from '../authResolver';

describe('RemoteWSLResolver', () => {
    describe('parseAuthority', () => {
        it('should parse "wsl+Ubuntu"', () => {
            expect(RemoteWSLResolver.parseAuthority('wsl+Ubuntu')).to.equal('Ubuntu');
        });

        it('should parse "wsl+Ubuntu-22.04"', () => {
            expect(RemoteWSLResolver.parseAuthority('wsl+Ubuntu-22.04')).to.equal('Ubuntu-22.04');
        });

        it('should parse authority with encoded characters', () => {
            expect(RemoteWSLResolver.parseAuthority('wsl+My%20Distro')).to.equal('My Distro');
        });

        it('should throw on invalid authority', () => {
            expect(() => RemoteWSLResolver.parseAuthority('ssh+host')).to.throw('Invalid WSL authority');
        });

        it('should handle empty distro name', () => {
            expect(RemoteWSLResolver.parseAuthority('wsl+')).to.equal('');
        });
    });
});
