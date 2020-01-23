'use strict';

module.exports = {
  /**
   * Check if a standup exists.
   *
   * @param {Object} client - DynamoDB document client
   * @param {String} tableName
   * @param {String} workspaceId
   * @param {String} standupId
   *
   * @return {Promise} Resolves with Boolean
   *
   * For SDK documentation see:
   * https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#get-property
   */
  exists(client, tableName, workspaceId, standupId) {
    const params = {
      TableName: tableName,
      Key: {
        pk: `workspace#${workspaceId}`,
        sk: `standup#${standupId}`
      }
    };

    return client
      .get(params)
      .promise()
      .then(data => Boolean(data.Item));
  }
};
