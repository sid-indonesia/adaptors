
import 'regenerator-runtime/runtime.js';
import {
  execute as commonExecute,
  expandReferences,
  composeNextState,
} from '@openfn/language-common';
import fs from 'fs';
import parse from 'csv-parse';
import { BigQuery } from '@google-cloud/bigquery';
import { resolve } from 'path';

/**
 * Execute a sequence of operations.
 * Wraps `language-common/execute`, and prepends initial state for http.
 * @example
 * execute(
 *   create('foo'),
 *   delete('bar')
 * )(state)
 * @function
 * @param {Operations} operations - Operations to be performed.
 * @returns {Operation}
 */
export function execute(...operations) {
  const initialState = {
    references: [],
    data: null,
  };

  return state => {
    return commonExecute(...operations)({ ...initialState, ...state });
  };
}

/**
 * Load files to BigQuery
 * @public
 * @example
 * load(
 *   './tmp/files',
 *   'my-bg-project',
 *   'test01',
 *   'product-codes',
 *   {
 *     schema: 'FREQ:STRING,DATATYPE:STRING,PRODUCTCODE:STRING,PARTNER:STRING',
 *     writeDisposition: 'WRITE_APPEND',
 *     skipLeadingRows: 1,
 *     schemaUpdateOptions: ['ALLOW_FIELD_ADDITION'],
 *     createDisposition: 'CREATE_IF_NEEDED',
 *   }
 * )
 * @function
 * @param {string} dirPath - the path to your local directory
 * @param {string} projectId - your bigquery project id
 * @param {string} datasetId - your bigquery dataset id
 * @param {string} tableId - the name of the table you'd like to load
 * @param {object} loadOptions - options to pass to the bigquery.load() API
 * @param {function} callback - and optional callback
 * @returns {Operation}
 */
export function load(
  dirPath,
  projectId,
  datasetId,
  tableId,
  loadOptions,
  callback
) {
  // something that loads data (from a CSV?) to BigQuery
  return state => {
    const bigquery = new BigQuery({
      credentials: state.configuration,
      projectId,
    });
    // In this example, the existing table contains only the 'Name', 'Age',
    // & 'Weight' columns. 'REQUIRED' fields cannot  be added to an existing
    // schema, so the additional column must be 'NULLABLE'.
    async function loadData(files) {
      // Retrieve destination table reference
      const [table] = await bigquery.dataset(datasetId).table(tableId).get();

      const destinationTableRef = table.metadata.tableReference;

      // Set load job options
      const options = { ...loadOptions, destinationTableRef };

      for (const file of files) {
        const fileName = `${dirPath}/${file}`;
        const [job] = await bigquery
          .dataset(datasetId)
          .table(tableId)
          .load(fileName, options);

        console.log(`Job ${job.id} completed.`);
        console.log('New Schema:');
        console.log(job.configuration.load.schema.fields);
        // Check the job's status for errors
        const errors = job.status.errors;
        if (errors && errors.length > 0) {
          throw errors;
        }
      }

      return state;
    }

    return new Promise((resolve, reject) => {
      console.log('Google Big Query: loading files');
      return fs.readdir(dirPath, function (err, files) {
        //handling error
        if (err) {
          return console.log('Unable to scan directory: ' + err);
        }
        resolve(loadData(files));
      });
    }).then(() => {
      console.log('all done');
      return state;
    });
  };
}

/**
 * CSV-Parse for CSV conversion to JSON
 * @public
 * @example
 *  parseCSV("/home/user/someData.csv", {
 * 	  quoteChar: '"',
 * 	  header: false,
 * 	});
 * @function
 * @param {String} target - string or local file with CSV data
 * @param {Object} config - csv-parse config object
 * @returns {Operation}
 */
export function parseCSV(target, config) {
  return state => {
    return new Promise((resolve, reject) => {
      var csvData = [];

      try {
        fs.readFileSync(target);
        fs.createReadStream(target)
          .pipe(parse(config))
          .on('data', csvrow => {
            console.log(csvrow);
            csvData.push(csvrow);
          })
          .on('end', () => {
            console.log(csvData);
            resolve(composeNextState(state, csvData));
          });
      } catch (err) {
        var csvString;
        if (typeof target === 'string') {
          csvString = target;
        } else {
          csvString = expandReferences(target)(state);
        }
        csvData = parse(csvString, config, (err, output) => {
          console.log(output);
          resolve(composeNextState(state, output));
        });
      }
    });
  };
}

export {
  alterState,
  dataPath,
  combine,
  dataValue,
  each,
  field,
  fields,
  http,
  lastReferenceValue,
  merge,
  sourceValue,
} from '@openfn/language-common';
