import {select} from "redux-saga/effects";

import {doesErrorExist} from "../../bl/mydata/mydata-work-orders";
import {getDownloadAccessToken, getBoxFilesDownloadLinks} from "../../services/mydata/mydata-file-download";
import {splunkLogger} from "../../services/splunkLogger";

export function* getDownloadLinkAPI({documentIds}) {
    const offeringId = yield select(state => state.appState.offeringId);
    // 1- get access token from document service and return here
    const accessToken = yield getDownloadAccessToken(documentIds[0]);
    const _accessTokenResponse = accessToken.response;
    const accessTokenString = _accessTokenResponse.accessToken;
    const _accessTokenError = accessToken.error;
    const accessTokenErrorExist = doesErrorExist(_accessTokenResponse, _accessTokenError);
    if (accessTokenErrorExist) {
        splunkLogger.logInfo({
            name: "splunk: get-download-access-token-response-FAIL",
            message: JSON.stringify({
                pluginName: "iam-account-manager-ui",
                serviceName: "get-download-access-token"
            })
        }, offeringId);
    } else {
        splunkLogger.logInfo({
            name: "splunk: get-download-access-token-response-SUCCESS",
            message: JSON.stringify({
                pluginName: "iam-account-manager-ui",
                serviceName: "get-download-access-token"
            })
        }, offeringId);
    }
    // 2- get and download full download links from the box api
    yield getBoxFilesDownloadLinks(documentIds, accessTokenString);
}
