import { runChecked } from './workspace-command.spec.util.ts';
import { packageQuerySchema } from '../common/turbo-query.schema.ts';
import type { QueriedPackage, QueriedTask } from '../common/turbo-query.type.ts';

/** Package `name`'s tags and its tasks with their tags, from `turbo query`. */
export const queryPackage = async (root: string, name: string): Promise<QueriedPackage> => {
  const query = `{ package(name: ${JSON.stringify(name)}) { tags tasks { items { name tags } } } }`;
  const result = await runChecked(root, `turbo query ${JSON.stringify(query)}`);
  const raw: unknown = JSON.parse(result.stdout);
  const parsed = packageQuerySchema.parse(raw);
  const { tags, tasks } = parsed.data.package;
  const queried: QueriedPackage = { tags, tasks: tasks.items };

  return queried;
};

const nameOf = (task: QueriedTask): string => task.name;

/** Names of the tasks that carry `tag`, sorted. */
export const tasksTagged = (pkg: QueriedPackage, tag: string): string[] => {
  const tagged = pkg.tasks.filter((task): boolean => task.tags.includes(tag));

  return tagged.map(nameOf).toSorted();
};
