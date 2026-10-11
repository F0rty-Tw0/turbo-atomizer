import { dep } from 'dep';
import { missing } from 'missing-package';

import { shared } from '../../../shared/x.ts';
import { helper } from '../helpers/h.ts';

export const total = helper + shared + dep + missing;
