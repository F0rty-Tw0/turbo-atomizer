import type { PeerVersionFinding } from './workspace.type.ts';

export class PeerVersionException extends Error {
  public readonly findings: PeerVersionFinding[];

  public constructor(findings: PeerVersionFinding[]) {
    super(findings.map((finding) => finding.message).join('\n'));
    this.name = 'PeerVersionException';
    this.findings = findings;
  }
}
