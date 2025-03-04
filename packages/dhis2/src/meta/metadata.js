import { createEntity } from '@openfn/metadata';
import dhis2helper from './helper.js';

const metadata = async (configuration = {}, helper) => {
  if (!helper) {
    helper = dhis2helper(configuration);
  }

  const children = {};

  const units = await helper.getOrgUnits();
  children.orgUnits = units.organisationUnits.map(unit =>
    createEntity(unit.id, 'orgUnit', {
      datatype: 'string',
      label: unit.displayName,
    })
  );

  children.resourceTypes = await helper.getResourceTypes();

  const types = (await helper.getTrackedEntityTypes()) ?? [];
  children.trackedEntityTypes =
    types.trackedEntityTypes?.map(type =>
      createEntity(type.id, 'trackedEntityType', {
        datatype: 'string',
        label: type.displayName,
      })
    ) ?? [];

  const attributes = (await helper.getAttributes()) ?? [];
  children.attributes =
    attributes.attributes?.map(attr =>
      createEntity(attr.id, 'attribute', {
        datatype: 'string',
        label: attr.displayName,
      })
    ) ?? [];

  return {
    type: 'model',
    name: 'dhis2',
    children,
  };
};

export default metadata;
