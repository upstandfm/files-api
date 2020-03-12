'use strict';

module.exports = {
  /**
   * Check if a channel exists.
   *
   * @param {Object} client - DynamoDB document client
   * @param {String} tableName
   * @param {String} workspaceId
   * @param {String} channelId
   *
   * @return {Promise} Resolves with Boolean
   *
   * For SDK documentation see:
   * https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#get-property
   */
  exists(client, tableName, workspaceId, channelId) {
    const params = {
      TableName: tableName,
      Key: {
        pk: `workspace#${workspaceId}`,
        sk: `channel#${channelId}`
      }
    };

    return client
      .get(params)
      .promise()
      .then(data => Boolean(data.Item));
  }
};
