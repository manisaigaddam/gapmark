import { workbench } from '../shared/workbench.mjs';

export default function Page() {
  return <div dangerouslySetInnerHTML={{ __html: workbench }} />;
}
