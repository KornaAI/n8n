import type {
	IExecuteFunctions,
	IDataObject,
	INodeExecutionData,
	ResourceMapperField,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	cellFormat,
	handlingExtraData,
	locationDefine,
	useAppendOption,
} from './commonDescription';
import type { GoogleSheet } from '../../helpers/GoogleSheet';
import {
	ROW_NUMBER,
	type ISheetUpdateData,
	type SheetProperties,
	type ValueInputOption,
	type ValueRenderOption,
} from '../../helpers/GoogleSheets.types';
import {
	cellFormatDefault,
	checkForSchemaChanges,
	untilSheetSelected,
} from '../../helpers/GoogleSheets.utils';

export const description: SheetProperties = [
	{
		displayName: 'Data Mode',
		name: 'dataMode',
		type: 'options',
		options: [
			{
				name: 'Auto-Map Input Data to Columns',
				value: 'autoMapInputData',
				description: 'Use when node input properties match destination column names',
			},
			{
				name: 'Map Each Column Below',
				value: 'defineBelow',
				description: 'Set the value for each destination column',
			},
			{
				name: 'Nothing',
				value: 'nothing',
				description: 'Do not send anything',
			},
		],
		displayOptions: {
			show: {
				resource: ['sheet'],
				operation: ['appendOrUpdate'],
				'@version': [3],
			},
			hide: {
				...untilSheetSelected,
			},
		},
		default: 'defineBelow',
		description: 'Whether to insert the input data this node receives in the new row',
	},
	{
		// eslint-disable-next-line n8n-nodes-base/node-param-display-name-miscased, n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options
		displayName: 'Column to match on',
		name: 'columnToMatchOn',
		type: 'options',
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		typeOptions: {
			loadOptionsDependsOn: ['sheetName.value'],
			loadOptionsMethod: 'getSheetHeaderRowAndSkipEmpty',
		},
		default: '',
		hint: "Used to find the correct row to update. Doesn't get changed.",
		displayOptions: {
			show: {
				resource: ['sheet'],
				operation: ['appendOrUpdate'],
				'@version': [3],
			},
			hide: {
				...untilSheetSelected,
			},
		},
	},
	{
		displayName: 'Value of Column to Match On',
		name: 'valueToMatchOn',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['sheet'],
				operation: ['appendOrUpdate'],
				dataMode: ['defineBelow'],
				'@version': [3],
			},
			hide: {
				...untilSheetSelected,
			},
		},
	},
	{
		displayName: 'Values to Send',
		name: 'fieldsUi',
		placeholder: 'Add Field',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		displayOptions: {
			show: {
				resource: ['sheet'],
				operation: ['appendOrUpdate'],
				dataMode: ['defineBelow'],
				'@version': [3],
			},
			hide: {
				...untilSheetSelected,
			},
		},
		default: {},
		options: [
			{
				displayName: 'Field',
				name: 'values',
				values: [
					{
						// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options
						displayName: 'Column',
						name: 'column',
						type: 'options',
						description:
							'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
						typeOptions: {
							loadOptionsDependsOn: ['sheetName.value', 'columnToMatchOn'],
							loadOptionsMethod: 'getSheetHeaderRowAndAddColumn',
						},
						default: '',
					},
					{
						displayName: 'Column Name',
						name: 'columnName',
						type: 'string',
						default: '',
						displayOptions: {
							show: {
								column: ['newColumn'],
							},
						},
					},
					{
						displayName: 'Value',
						name: 'fieldValue',
						type: 'string',
						default: '',
					},
				],
			},
		],
	},
	{
		displayName: 'Columns',
		name: 'columns',
		type: 'resourceMapper',
		noDataExpression: true,
		default: {
			mappingMode: 'defineBelow',
			value: null,
		},
		required: true,
		typeOptions: {
			loadOptionsDependsOn: ['sheetName.value'],
			resourceMapper: {
				resourceMapperMethod: 'getMappingColumns',
				mode: 'upsert',
				fieldWords: {
					singular: 'column',
					plural: 'columns',
				},
				addAllFields: true,
				multiKeyMatch: false,
				allowEmptyValues: true,
			},
		},
		displayOptions: {
			show: {
				resource: ['sheet'],
				operation: ['appendOrUpdate'],
				'@version': [{ _cnd: { gte: 4.7 } }],
			},
			hide: {
				...untilSheetSelected,
			},
		},
	},
	{
		displayName: 'Columns',
		name: 'columns',
		type: 'resourceMapper',
		noDataExpression: true,
		default: {
			mappingMode: 'defineBelow',
			value: null,
		},
		required: true,
		typeOptions: {
			loadOptionsDependsOn: ['sheetName.value'],
			resourceMapper: {
				resourceMapperMethod: 'getMappingColumns',
				mode: 'upsert',
				fieldWords: {
					singular: 'column',
					plural: 'columns',
				},
				addAllFields: true,
				multiKeyMatch: false,
			},
		},
		displayOptions: {
			show: {
				resource: ['sheet'],
				operation: ['appendOrUpdate'],
				'@version': [{ _cnd: { between: { from: 4, to: 4.6 } } }],
			},
			hide: {
				...untilSheetSelected,
			},
		},
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: {
			show: {
				resource: ['sheet'],
				operation: ['appendOrUpdate'],
			},
			hide: {
				...untilSheetSelected,
			},
		},
		options: [
			cellFormat,
			locationDefine,
			handlingExtraData,
			{
				...handlingExtraData,
				displayOptions: { show: { '/columns.mappingMode': ['autoMapInputData'] } },
			},
			useAppendOption,
		],
	},
];

export async function execute(
	this: IExecuteFunctions,
	sheet: GoogleSheet,
	sheetName: string,
	sheetId: string,
): Promise<INodeExecutionData[]> {
	const items = this.getInputData();
	const nodeVersion = this.getNode().typeVersion;

	const range = `${sheetName}!A:Z`;

	const valueInputMode = this.getNodeParameter(
		'options.cellFormat',
		0,
		cellFormatDefault(nodeVersion),
	) as ValueInputOption;

	const options = this.getNodeParameter('options', 0, {});

	const valueRenderMode = (options.valueRenderMode || 'UNFORMATTED_VALUE') as ValueRenderOption;

	const locationDefineOption = (options.locationDefine as IDataObject)?.values as IDataObject;

	let keyRowIndex = 0;
	let dataStartRowIndex = 1;

	if (locationDefineOption) {
		if (locationDefineOption.headerRow) {
			keyRowIndex = parseInt(locationDefineOption.headerRow as string, 10) - 1;
		}
		if (locationDefineOption.firstDataRow) {
			dataStartRowIndex = parseInt(locationDefineOption.firstDataRow as string, 10) - 1;
		}
	}

	let dataMode =
		nodeVersion < 4
			? (this.getNodeParameter('dataMode', 0) as string)
			: (this.getNodeParameter('columns.mappingMode', 0) as string);

	let columnNames: string[] = [];

	const sheetData = (await sheet.getData(sheetName, 'FORMATTED_VALUE')) ?? [];

	if (!sheetData[keyRowIndex] && dataMode !== 'autoMapInputData') {
		if (!sheetData.length) {
			dataMode = 'autoMapInputData';
		} else {
			throw new NodeOperationError(
				this.getNode(),
				`Could not retrieve the column names from row ${keyRowIndex + 1}`,
			);
		}
	}

	columnNames = sheetData[keyRowIndex] ?? [];

	if (nodeVersion >= 4.4) {
		const schema = this.getNodeParameter('columns.schema', 0) as ResourceMapperField[];
		checkForSchemaChanges(this.getNode(), columnNames, schema);
	}

	const newColumns = new Set<string>();

	const columnsToMatchOn: string[] =
		nodeVersion < 4
			? [this.getNodeParameter('columnToMatchOn', 0) as string]
			: (this.getNodeParameter('columns.matchingColumns', 0) as string[]);

	// TODO: Add support for multiple columns to match on in the next overhaul
	const keyIndex = columnNames.indexOf(columnsToMatchOn[0]);

	const columnValuesList = await sheet.getColumnValues({
		range,
		keyIndex,
		dataStartRowIndex,
		valueRenderMode,
		sheetData,
	});

	const updateData: ISheetUpdateData[] = [];
	const appendData: IDataObject[] = [];

	const errorOnUnexpectedColumn = (key: string, i: number) => {
		if (!columnNames.includes(key)) {
			throw new NodeOperationError(this.getNode(), 'Unexpected fields in node input', {
				itemIndex: i,
				description: `The input field '${key}' doesn't match any column in the Sheet. You can ignore this by changing the 'Handling extra data' field, which you can find under 'Options'.`,
			});
		}
	};

	const addNewColumn = (key: string) => {
		if (!columnNames.includes(key) && key !== ROW_NUMBER) {
			newColumns.add(key);
		}
	};

	const mappedValues: IDataObject[] = [];
	for (let i = 0; i < items.length; i++) {
		if (dataMode === 'nothing') continue;

		const inputData: IDataObject[] = [];

		if (dataMode === 'autoMapInputData') {
			const handlingExtraDataOption = (options.handlingExtraData as string) || 'insertInNewColumn';
			if (handlingExtraDataOption === 'ignoreIt') {
				inputData.push(items[i].json);
			}
			if (handlingExtraDataOption === 'error') {
				Object.keys(items[i].json).forEach((key) => errorOnUnexpectedColumn(key, i));
				inputData.push(items[i].json);
			}
			if (handlingExtraDataOption === 'insertInNewColumn') {
				Object.keys(items[i].json).forEach(addNewColumn);
				inputData.push(items[i].json);
			}
		} else {
			const valueToMatchOn =
				nodeVersion < 4
					? (this.getNodeParameter('valueToMatchOn', i, '') as string)
					: (this.getNodeParameter(`columns.value[${columnsToMatchOn[0]}]`, i, '') as string);

			if (valueToMatchOn === '') {
				throw new NodeOperationError(
					this.getNode(),
					"The 'Column to Match On' parameter is required",
					{
						itemIndex: i,
					},
				);
			}

			if (nodeVersion < 4) {
				const valuesToSend = this.getNodeParameter('fieldsUi.values', i, []) as IDataObject[];
				if (!valuesToSend?.length) {
					throw new NodeOperationError(
						this.getNode(),
						"At least one value has to be added under 'Values to Send'",
					);
				}

				const fields = valuesToSend.reduce((acc, entry) => {
					if (entry.column === 'newColumn') {
						const columnName = entry.columnName as string;
						if (!columnNames.includes(columnName)) {
							newColumns.add(columnName);
						}
						acc[columnName] = entry.fieldValue as string;
					} else {
						acc[entry.column as string] = entry.fieldValue as string;
					}
					return acc;
				}, {} as IDataObject);
				fields[columnsToMatchOn[0]] = valueToMatchOn;
				inputData.push(fields);
			} else {
				const mappingValues = this.getNodeParameter('columns.value', i) as IDataObject;
				if (Object.keys(mappingValues).length === 0) {
					throw new NodeOperationError(
						this.getNode(),
						"At least one value has to be added under 'Values to Send'",
					);
				}
				// Setting empty values to empty string so that they are not ignored by the API
				Object.keys(mappingValues).forEach((key) => {
					if (mappingValues[key] === undefined || mappingValues[key] === null) {
						mappingValues[key] = '';
					}
				});
				inputData.push(mappingValues);
				mappedValues.push(mappingValues);
			}
		}

		if (newColumns.size) {
			const newColumnNames = columnNames.concat([...newColumns]);
			await sheet.updateRows(
				sheetName,
				[newColumnNames],
				(options.cellFormat as ValueInputOption) || cellFormatDefault(nodeVersion),
				keyRowIndex + 1,
			);
			columnNames = newColumnNames;
			sheetData[keyRowIndex] = newColumnNames;
			newColumns.clear();
		}

		const indexKey = columnsToMatchOn[0];

		const preparedData = await sheet.prepareDataForUpdateOrUpsert({
			inputData,
			indexKey,
			range,
			keyRowIndex,
			dataStartRowIndex,
			valueRenderMode,
			upsert: true,
			columnNamesList: [columnNames.concat([...newColumns])],
			columnValuesList,
		});

		updateData.push(...preparedData.updateData);
		appendData.push(...preparedData.appendData);
	}

	const columnNamesList = [columnNames.concat([...newColumns])];

	if (updateData.length) {
		await sheet.batchUpdate(updateData, valueInputMode);
	}
	if (appendData.length) {
		const lastRow = sheetData.length + 1;
		const useAppend = options.useAppend as boolean;

		if (options.useAppend) {
			await sheet.appendSheetData({
				inputData: appendData,
				range,
				keyRowIndex: keyRowIndex + 1,
				valueInputMode,
				columnNamesList,
				lastRow,
				useAppend,
			});
		} else {
			await sheet.appendEmptyRowsOrColumns(sheetId, 1, 0);
			await sheet.appendSheetData({
				inputData: appendData,
				range,
				keyRowIndex: keyRowIndex + 1,
				valueInputMode,
				columnNamesList,
				lastRow,
			});
		}
	}

	if (nodeVersion < 4 || dataMode === 'autoMapInputData') {
		return items.map((item, index) => {
			item.pairedItem = { item: index };
			return item;
		});
	} else {
		const returnData: INodeExecutionData[] = [];
		for (const [index, entry] of mappedValues.entries()) {
			returnData.push({
				json: entry,
				pairedItem: { item: index },
			});
		}
		return returnData;
	}
}
