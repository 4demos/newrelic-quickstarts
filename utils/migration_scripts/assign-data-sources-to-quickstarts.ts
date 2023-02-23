import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';

import Quickstart from '../lib/Quickstart';
import { passedProcessArguments } from '../lib/helpers';

const parseCSV = (csvString: string) => {
  const csvRows = csvString.split('\r\n');

  return csvRows.reduce((acc: Record<string, string>, row: string, idx) => {
    if (idx === 0) {
      return acc;
    }

    const rowValues = row.split(',');
    const nextAcc = { ...acc, [rowValues[0]]: rowValues[1] };

    return nextAcc;
  }, {});
};

const NOT_DATASOURCE_IDS = ['TO_BE_CREATED', 'MANUAL'];

const main = async () => {
  const [csvRelativePath] = passedProcessArguments();
  const quickstarts = Quickstart.getAll();

  const fullCSVPath = path.resolve(__dirname, csvRelativePath);

  const csvString = fs.readFileSync(fullCSVPath, { encoding: 'utf-8' });
  const installPlansToDataSources = parseCSV(csvString);

  const installPlanIdsWithoutDataSource: string[] = [];

  quickstarts.forEach((quickstart) => {
    const installPlanIds = quickstart.config.installPlans ?? [];
    const existingDataSourceIds = quickstart.config.dataSourceIds ?? [];

    if (installPlanIds.length === 0) {
      return;
    }

    const newDataSourceIds = installPlanIds.reduce(
      (acc: string[], installPlanId) => {
        const dataSourceId: string =
          installPlansToDataSources[installPlanId] ?? undefined;

        if (dataSourceId === undefined) {
          installPlanIdsWithoutDataSource.push(installPlanId);
          return acc;
        }

        if (NOT_DATASOURCE_IDS.includes(dataSourceId)) {
          return acc;
        }

        return [...acc, dataSourceId];
      },
      []
    );

    const nextDataSourceIds = [
      ...new Set([...existingDataSourceIds, ...newDataSourceIds]),
    ];

    if (nextDataSourceIds.length === 0) {
      return;
    }

    const qsYaml = yaml.load(
      fs.readFileSync(quickstart.configPath, { encoding: 'utf-8' })
    ) as Record<string, any>;

    qsYaml['dataSourceIds'] = nextDataSourceIds;

    const yamlOptions = {
      lineWidth: -1, // Unlimited
    };

    /* 
       TODO: Look into how to preserve comments 
       TODO: Ordering dataSourceIds after installPlans, 
             or ordering the whole yaml, or neither?
    */
    fs.writeFileSync(
      path.resolve(quickstart.basePath, quickstart.identifier),
      yaml.dump(qsYaml, yamlOptions)
    );
  });

  console.log('Data source assignment to quickstarts complete.');
  console.log(
    `Install plan ids without a datasource: ${installPlanIdsWithoutDataSource.length}`,
    installPlanIdsWithoutDataSource
  );
};

main();
