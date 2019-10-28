'use strict';

module.exports = {
  /**
   * Check if a user is a member of a standup.
   *
   * @param {Object} client - DynamoDB document client
   * @param {String} tableName - DynamoDB table name
   * @param {String} standupId
   * @param {String} userId
   *
   * @return {Promise} Resolves with Boolean
   *
   * For SDK documentation see:
   * https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#get-property
   */
  userIsMember(client, tableName, standupId, userId) {
    const params = {
      TableName: tableName,
      Key: {
        pk: `standup#${standupId}`,
        sk: `user#${userId}`
      }
    };

    return client
      .get(params)
      .promise()
      .then(data => Boolean(data.Item));
  }
};
