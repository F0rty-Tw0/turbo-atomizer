import { z } from 'zod';

import { checkCoverage } from './doctor-coverage.util.ts';
import { checkMetadata } from './doctor-metadata.util.ts';
import { ALL_TASK_SUFFIX } from '../../shared/atomizer/common/atomizer.const.ts';
import type { PeerVersionFinding } from '../../shared/workspace/common/workspace.type.ts';
import { checkPeerVersions } from '../../shared/workspace/utils/peer-versions.util.ts';
import type { AtomsDiff } from '../../sync/common/atoms-diff.type.ts';
import type { DoctorFacts } from '../common/doctor-facts.type.ts';
import type { DoctorFinding } from '../common/doctor-finding.type.ts';

const dependsOnField = z.array(z.string()).optional();

const umbrellaTaskSchema = z.looseObject({ dependsOn: dependsOnField });

const error = (code: DoctorFinding['code'], message: string): DoctorFinding => {
  const finding: DoctorFinding = { level: 'error', code, message };

  return finding;
};

const staleFindings = (stale: AtomsDiff | undefined): DoctorFinding[] => {
  if (stale === undefined) return [];

  const { added, removed, changed } = stale;
  const isFileTaskDiff = added.length + removed.length + changed.length > 0;
  const counts = `${String(added.length)} added, ${String(removed.length)} removed, ${String(changed.length)} changed`;
  const reason = isFileTaskDiff ? counts : 'carriers or formatting only';

  return [error('stale-generated', `The generated file tasks are stale (${reason}); run \`turbo-atomizer sync\`.`)];
};

const helperFindings = (facts: DoctorFacts): DoctorFinding[] => {
  if (facts.metadata !== undefined) return [];

  return [error('helper-missing', 'The Playwright config reports no turbo-atomizer metadata; wrap it in `withAtomizer(config)`.')];
};

const dependsOnAll = (task: unknown, allTask: string): boolean => {
  const parsed = umbrellaTaskSchema.safeParse(task);
  const dependsOn = parsed.data?.dependsOn ?? [];

  return dependsOn.includes(allTask);
};

const turboJsonFindings = (facts: DoctorFacts): DoctorFinding[] => {
  if (facts.testTurboJson === undefined) {
    return [error('test-turbo-json-drift', 'The test package has no turbo.json; run `turbo-atomizer init`.')];
  }

  const { content, path } = facts.testTurboJson;
  const allTask = `${facts.task}${ALL_TASK_SUFFIX}`;
  const extendsList = content.extends ?? [];
  const isExtending = extendsList.includes(facts.generatedName);
  const umbrellaTask = content.tasks?.[facts.task];
  const isUmbrella = dependsOnAll(umbrellaTask, allTask);
  const findings: DoctorFinding[] = [];

  if (!isExtending) {
    findings.push(error('test-turbo-json-drift', `${path} no longer extends "${facts.generatedName}"; add it to "extends".`));
  }

  if (!isUmbrella) {
    findings.push(error('test-turbo-json-drift', `${path}: task "${facts.task}" no longer depends on "${allTask}".`));
  }

  return findings;
};

const flagFindings = (facts: DoctorFacts): DoctorFinding[] => {
  const message =
    'The root turbo.json lacks `futureFlags.affectedUsingTaskInputs: true`; `turbo-atomizer affected` then runs every file task of an affected package.';
  const affectedWarning: DoctorFinding = { level: 'warning', code: 'affected-flag-missing', message };
  const findings: DoctorFinding[] = [];

  if (!facts.taskCommandFlagSet) {
    findings.push(error('root-flag-missing', 'The root turbo.json lacks `futureFlags.experimentalTaskCommand: true`; file tasks need it.'));
  }

  if (!facts.affectedFlagSet) findings.push(affectedWarning);

  return findings;
};

const toVersionFinding = (peerFinding: PeerVersionFinding): DoctorFinding => {
  const isWarning = peerFinding.level === 'warning';
  const finding: DoctorFinding = { level: peerFinding.level, code: 'peer-version', message: peerFinding.message };
  const warning: DoctorFinding = { ...finding, code: 'turbo-untested' };

  return isWarning ? warning : finding;
};

const rejectedFinding = (spec: string): DoctorFinding => {
  return error(
    'spec-rejected',
    `${spec} is not matched by specGlobs, is outside the package root, or has glob metacharacters in its path.`
  );
};

const turboQueryFindings = (facts: DoctorFacts): DoctorFinding[] => {
  if (facts.turboQueryFailure === undefined) return [];

  return [error('turbo-query-failed', `The app-dependency and outside-import checks did not run: ${facts.turboQueryFailure}`)];
};

/** Without `experimentalTaskCommand` turbo is never queried, and a failed query leaves no facts, so there is nothing to check then. */
const coverageChecks = (facts: DoctorFacts): DoctorFinding[] => {
  const isQueried = facts.taskCommandFlagSet && facts.turboQueryFailure === undefined;

  if (!isQueried) return [];

  return checkCoverage(facts);
};

const metadataChecks = (facts: DoctorFacts): DoctorFinding[] => {
  if (facts.metadata === undefined) return [];

  return checkMetadata(facts.metadata);
};

/** Runs every doctor check (spec §6.4) over gathered facts; any `error` finding fails doctor. */
export const runDoctorChecks = (facts: DoctorFacts): DoctorFinding[] => {
  const peerFindings = checkPeerVersions(facts.versions.turbo, facts.versions.playwright);
  const generatedFindings = staleFindings(facts.stale);
  const configFindings = helperFindings(facts);
  const testTurboJsonFindings = turboJsonFindings(facts);
  const rootFlagFindings = flagFindings(facts);
  const versionFindings = peerFindings.map(toVersionFinding);
  const specFindings = facts.rejectedSpecs.map(rejectedFinding);
  const metadataFindings = metadataChecks(facts);
  const queryFindings = turboQueryFindings(facts);
  const coverageFindings = coverageChecks(facts);

  return [
    ...generatedFindings,
    ...configFindings,
    ...testTurboJsonFindings,
    ...rootFlagFindings,
    ...versionFindings,
    ...specFindings,
    ...metadataFindings,
    ...queryFindings,
    ...coverageFindings
  ];
};
