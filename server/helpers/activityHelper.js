module.exports.getChangedState = function(
    dataRecord,
    { nested, propertyName, allowedProperties, oldModel } = {},
) {
    let changes = [];

    if (dataRecord && oldModel) {
        let changedItem = {
            property: propertyName,
            from: oldModel
                ? allowedProperties.map(item => oldModel.get(item)).join(', ')
                : null,
            to: allowedProperties.map(item => dataRecord.get(item)).join(', '),
        };
        if (changedItem.from === changedItem.to) {
            return false;
        }
        changes.push(changedItem);
    } else if (dataRecord) {
        if (typeof dataRecord.changed === 'function') {
            let _changedKeys = dataRecord.changed();
            if (_changedKeys && _changedKeys.length > 0) {
                if (
                    allowedProperties &&
                    Array.isArray(allowedProperties) &&
                    allowedProperties.length > 0
                ) {
                    _changedKeys = _changedKeys.filter(
                        item => allowedProperties.indexOf(item) > -1,
                    );
                }
                if (_changedKeys.length === 0) {
                    return false;
                }
                if (!nested) {
                    _changedKeys.forEach(keyName => {
                        changes.push({
                            property: keyName,
                            from: dataRecord._previousDataValues
                                ? dataRecord._previousDataValues[keyName]
                                : null,
                            to: dataRecord.get(keyName),
                        });
                    });
                } else {
                    changes.push({
                        property: propertyName,
                        from: oldModel
                            ? _changedKeys
                                  .map(item => oldModel.get(item))
                                  .join(', ')
                            : dataRecord._previousDataValues
                                ? _changedKeys
                                      .map(
                                          item =>
                                              dataRecord._previousDataValues[
                                                  item
                                              ],
                                      )
                                      .join(', ')
                                : undefined,
                        to: _changedKeys
                            .map(item => dataRecord.get(item))
                            .join(', '),
                    });
                }
            }
        }
    }

    return changes;
};
