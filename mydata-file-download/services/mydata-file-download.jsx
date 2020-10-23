import {
  DOCUMENT_SERVICE_BASE_URL,
  BOX_API_DOWNLOAD_BASE_URL,
  BOX_FIELD_DOWNLOAD_URL,
} from '../../constants';
import { getHandledServiceRequest } from '../ServiceHandler';
import { callHandleServiceRequest, getRequestInfo } from './mydata-work-orders';
import { downloadZipFiles } from '../../bl/mydata/mydata-file-download';

/**
 * Call the Box API to GET full download links
 * @param {Array} documentIds: box documentIds that resolve to zip files
 * @param {String} accessTokenString: box api acces token
 */
export function getBoxFilesDownloadLinks(documentIds, accessTokenString) {
  const boxUrls = documentIds.map(
    (docId) =>
      `${BOX_API_DOWNLOAD_BASE_URL}${docId}?fields=${BOX_FIELD_DOWNLOAD_URL}`
  );
  const boxHeaders = {
    Authorization: `Bearer ${accessTokenString}`,
    'Content-Type': 'application/zip',
    'Content-Description': 'File Transfer',
    'Accept-Encoding': 'gzip, compress, deflate',
  };
  const pluginName = 'iam-account-manager-ui';
  const serviceName = 'mydata-get-box-files-download-links';
  const promisesArray = [];
  boxUrls.map((boxUrl) => {
    promisesArray.push(
      getHandledServiceRequest(
        {
          pluginName,
          serviceName,
        },
        (resolve, reject) => {
          fetch(boxUrl, {
            headers: boxHeaders,
          })
            .then((response) => response.json())
            .then((data) => {
              resolve(data.download_url);
            })
            .catch((err) => reject(err));
        }
      )
    );
  });

  Promise.all(promisesArray).then((res) => {
    const boxcloudUrls = [];
    res.forEach((boxcloudUrl) => {
      boxcloudUrls.push(Promise.resolve(boxcloudUrl.response));
    });
    // 3- call fxn in bl file to perform the actual download
    downloadZipFiles(boxcloudUrls);
  });
}

export function getDownloadAccessToken(documentId, env = 'e2e') {
  const query = `
    {
      "docSpace": "dg2",
      "targetEntities": {
      "documentIds": [
          "${documentId}"
      ]
    },
    "permissions": [
      "view"
    ]
  }
  `;
  const requestInfo = getRequestInfo(env, DOCUMENT_SERVICE_BASE_URL, '', '');
  return callHandleServiceRequest(
    'iam-account-manager-ui',
    'mydata-fetch-download-access-token',
    requestInfo,
    query,
    'POST'
  );
}
