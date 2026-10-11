import { z } from 'zod';

const pathItemSchema = z.object({ path: z.string() });

const taskItemSchema = z.object({ name: z.string() });

const fileDependenciesSchema = z.object({
  files: z.object({ items: z.array(pathItemSchema) })
});

const fileSchema = z.object({ dependencies: fileDependenciesSchema });

const dependencyPackageSchema = z.object({
  name: z.string(),
  path: z.string(),
  tasks: z.object({ items: z.array(taskItemSchema) })
});

const packageSchema = z.object({
  directDependencies: z.object({ items: z.array(dependencyPackageSchema) })
});

/** stdout of `turbo query` for `file(path) { dependencies { files { items { path } } } }`. */
export const fileDepsResultSchema = z.object({
  data: z.object({ file: fileSchema })
});

/** stdout of `turbo query` for `package(name) { directDependencies { items { name path tasks { items { name } } } } }`. */
export const packageTasksResultSchema = z.object({
  data: z.object({ package: packageSchema })
});

const fullNameItemSchema = z.object({ fullName: z.string() });

/** stdout of `turbo query` for `affectedTasks(taskFilter) { items { fullName } }`. */
export const affectedTasksResultSchema = z.object({
  data: z.object({ affectedTasks: z.object({ items: z.array(fullNameItemSchema) }) })
});
