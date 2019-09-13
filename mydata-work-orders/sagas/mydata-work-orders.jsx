import {put, select} from "redux-saga/effects";
import {cloneDeep} from "lodash-no-global";

import {setErrorState, toggleLoadingState, setMyDataState} from "../../actions/app";
import {MYDATA_CARD, DELETE_PRODUCT_SELECTED_FLAG} from "../../constants";
import {
    formatGetWorkOrdersResponse,
    formatProductList,
    doesErrorExist,
    sortProductList,
    rawProductList
} from "../../bl/mydata/mydata-work-orders";
import {splunkLogger} from "../../services/splunkLogger";
import {logAnalyticsMsg} from "../analyticsLogger";
import {
    getWorkOrders,
    verifyPassword,
    postConsent,
    createDownloadWorkOrders,
    createDeleteWorkOrders,
    cancelWorkOrders,
    postDelegation,
    deleteDelegation
} from "../../services/mydata/mydata-work-orders";

function generateErrorResponse(callback, errorMessage) {
    let response = {};
    if (errorMessage) {
        response = {
            errors: [
                {
                    errorMessage
                }
            ]
        };
    }
    const error = null;
    callback(false, response, error);
    return {response, error};
}

export function* getWorkOrdersAPI() {
    const state = yield select();
    const {cardsToLoad, offeringEnv, offeringId} = state.appState;
    const params = state.appState.queryParams;
    const {userId} = state.userInformation.raw;
    let response, error;

    // Only make the call if MyData card exists
    if (cardsToLoad.map(c => c.id).includes(MYDATA_CARD)) {
        const myDataIsInLoadingState = state.cards[MYDATA_CARD] && state.cards[MYDATA_CARD].loading;

        if (!myDataIsInLoadingState) {
            yield put(toggleLoadingState(MYDATA_CARD));
        }

        const getWorkOrdersResponse = yield getWorkOrders(offeringEnv, userId, params);
        error = getWorkOrdersResponse.error;
        response = getWorkOrdersResponse.response;
        const inError = doesErrorExist(response, error);

        if (inError) {
            splunkLogger.logInfo({
                name: "splunk: get-work-orders-response-FAIL",
                message: JSON.stringify({
                    pluginName: "iam-account-manager-ui",
                    serviceName: "get-work-orders-api"
                })
            }, offeringId);

            logAnalyticsMsg("get-work-orders-response-ERROR", {
                pluginName: "iam-account-manager-ui",
                serviceName: "get-work-orders-api"
            });
            yield put(setErrorState(MYDATA_CARD, inError));
        } else {
            splunkLogger.logInfo({
                name: "splunk: get-work-orders-response-SUCCESS",
                message: JSON.stringify({
                    pluginName: "iam-account-manager-ui",
                    serviceName: "get-work-orders-api"
                })
            }, offeringId);

            logAnalyticsMsg("get-work-orders-response - SUCCESS", {
                pluginName: "iam-account-manager-ui",
                serviceName: "get-work-orders-api"
            });
            const workOrder = formatGetWorkOrdersResponse(response);
            // get the sortedProducList and put it into MyDataState
            const aidParam = params.aid || "";
            const sortedProductList = sortProductList(cloneDeep(rawProductList), aidParam);
            yield put(setMyDataState({workOrder: workOrder, productList: sortedProductList}));
            yield put(toggleLoadingState(MYDATA_CARD));
        }
    }

    return {response, error};
};

export function* getPasswordVerificationAPI(username, passwordValue, offeringEnv, offeringId) {
    const verifyPasswordResponse = yield verifyPassword(username, passwordValue, offeringEnv);
    const response = verifyPasswordResponse.response;
    const error = verifyPasswordResponse.error;
    const inError = doesErrorExist(response, error);
    if (inError) {
        splunkLogger.logInfo({
            name: "splunk: password-verify-response-FAIL",
            message: JSON.stringify({
                pluginName: "iam-account-manager-ui",
                serviceName: "get-password-verify-api"
            })
        }, offeringId);
        return false;
    }
    splunkLogger.logInfo({
        name: "splunk: password-verify-response-SUCCESS",
        message: JSON.stringify({
            pluginName: "iam-account-manager-ui",
            serviceName: "get-password-verify-api"
        })
    }, offeringId);
    return response.iamTicket ? response.iamTicket.authenticationLevel : null;
};

export function* callPostConsentAPI(purpose, userId, consented, offeringEnv, offeringId) {
    const postConsentResponse = yield postConsent(purpose, userId, consented, offeringEnv);
    const response = postConsentResponse.response;
    const error = postConsentResponse.error;
    const inError = doesErrorExist(response, error);
    if (inError) {
        splunkLogger.logInfo({
            name: "splunk: consent-api-response-FAIL",
            message: JSON.stringify({
                pluginName: "iam-account-manager-ui",
                serviceName: "call-post-consent-api"
            })
        }, offeringId);
        return false;
    }
    splunkLogger.logInfo({
        name: "splunk: consent-api-response-SUCCESS",
        message: JSON.stringify({
            pluginName: "iam-account-manager-ui",
            serviceName: "call-post-consent-api"
        })
    }, offeringId);
    return true;
}

export function* callPostDelegationAPI(userId, offeringEnv, offeringId) {
    const postDelegationResponse = yield postDelegation(userId, offeringEnv);
    const response = postDelegationResponse.response;
    const error = postDelegationResponse.error;
    const errorExist = doesErrorExist(response, error);
    if (errorExist) {
        splunkLogger.logInfo({
            name: "splunk: delegation-api-response-FAIL",
            message: JSON.stringify({
                pluginName: "iam-account-manager-ui",
                serviceName: "call-post-delegation-api"
            })
        }, offeringId);
        return false;
    }
    splunkLogger.logInfo({
        name: "splunk: delegation-api-response-SUCCESS",
        message: JSON.stringify({
            pluginName: "iam-account-manager-ui",
            serviceName: "call-post-delegation-api"
        })
    }, offeringId);
    return true;
}

export function* callDeleteDelegationAPI(userId, offeringEnv, offeringId) {
    const deleteDelegationResponse = yield deleteDelegation(userId, offeringEnv);
    const response = deleteDelegationResponse.response;
    const error = deleteDelegationResponse.error;
    const errorExist = doesErrorExist(response, error);
    if (errorExist) {
        splunkLogger.logInfo({
            name: "splunk: delete-delegation-api-response-FAIL",
            message: JSON.stringify({
                pluginName: "iam-account-manager-ui",
                serviceName: "call-delete-delegation-api"
            })
        }, offeringId);
        return false;
    }
    splunkLogger.logInfo({
        name: "splunk: delete-delegation-api-response-SUCCESS",
        message: JSON.stringify({
            pluginName: "iam-account-manager-ui",
            serviceName: "call-delete-delegation-api"
        })
    }, offeringId);
    return true;
}

export function* createDownloadWorkOrderAPI({callback, password, consentPurpose}) {
    const state = yield select();
    const {offeringEnv, offeringId} = state.appState;
    const params = state.appState.queryParams;
    const {userId, username} = state.userInformation.raw;

    const verifyPasswordResponse = yield getPasswordVerificationAPI(username, password, offeringEnv, offeringId);

    if (!!verifyPasswordResponse) {
        const delegationResponse = yield callPostDelegationAPI(userId, offeringEnv, offeringId);
        if (delegationResponse) {
            const consentResponse = yield callPostConsentAPI(consentPurpose, userId, true, offeringEnv, offeringId);
            if (consentResponse) {
                const {productList} = state.myData;
                const selectedProducts = formatProductList(productList, "downloadSelected");

                // only create work order if verifyPassword and postConsent are successful
                const createWorkOrderResponse = yield  createDownloadWorkOrders(offeringEnv, userId, selectedProducts,
                    params);

                splunkLogger.logInfo({
                    name: "splunk: create-download-workorder-api-response-SUCCESS",
                    message: JSON.stringify({
                        pluginName: "iam-account-manager-ui",
                        serviceName: "create-download-workorder-api"
                    })
                }, offeringId);

                const response = createWorkOrderResponse.response;
                const error = createWorkOrderResponse.error;

                const inError = doesErrorExist(response, error);
                callback(!inError, response, error);
                 //Analytics Logger
                logAnalyticsMsg("download-confirm-request-SUCCESS", {});

                return {response, error};
            }
        } else {
            // consent response failed
            splunkLogger.logInfo({
                name: "splunk: create-download-workorder-api-consent-response-FAIL",
                message: JSON.stringify({
                    pluginName: "iam-account-manager-ui",
                    serviceName: "create-download-workorder-api"
                })
            }, offeringId);
            //Analytics Logger
            logAnalyticsMsg("download-confirm-request-FAILURE", {});
            return generateErrorResponse(callback, null);
        }
    } else {
        // password verify failed
        splunkLogger.logInfo({
            name: "splunk: create-download-workorder-api-password-verify-response-FAIL",
            message: JSON.stringify({
                pluginName: "iam-account-manager-ui",
                serviceName: "create-download-workorder-api"
            })
        }, offeringId);
        return generateErrorResponse(callback, "invalid_password");
    }
};

export function* createDeleteWorkOrderAPI({callback, password, consentPurpose}) {
    const state = yield select();
    const {offeringEnv, offeringId} = state.appState;
    const params = state.appState.queryParams;
    const {userId, username} = state.userInformation.raw;

    const verifyPasswordResponse = yield getPasswordVerificationAPI(username, password, offeringEnv, offeringId);

    if (!!verifyPasswordResponse) {
        const delegationResponse = yield callPostDelegationAPI(userId, offeringEnv, offeringId);
        if (delegationResponse) {
            const consentResponse = yield callPostConsentAPI(consentPurpose, userId, true, offeringEnv, offeringId);
            if (consentResponse) {
                const {productList} = state.myData;
                const selectedProducts = formatProductList(productList, DELETE_PRODUCT_SELECTED_FLAG);

                // only create work order if verifyPassword and postConsent are successful
                const createDeleteWorkOrderResponse = yield createDeleteWorkOrders(offeringEnv, userId, selectedProducts,
                    params);

                splunkLogger.logInfo({
                    name: "splunk: create-delete-workorder-api-response-SUCCESS",
                    message: JSON.stringify({
                        pluginName: "iam-account-manager-ui",
                        serviceName: "create-delete-workorder-api"
                    })
                }, offeringId);

                const response = createDeleteWorkOrderResponse.response;
                const error = createDeleteWorkOrderResponse.error;

                const inError = doesErrorExist(response, error);
                callback(!inError, response, error);
                logAnalyticsMsg("delete-confirm-request-SUCCESS", {});

                return {response, error};
            }
        } else {
            logAnalyticsMsg("delete-confirm-request-FAILURE", {});
            // consent response failed
            splunkLogger.logInfo({
                name: "splunk: create-delete-workorder-api-consent-response-FAIL",
                message: JSON.stringify({
                    pluginName: "iam-account-manager-ui",
                    serviceName: "create-delete-workorder-api"
                })
            }, offeringId);

            return generateErrorResponse(callback, null);
        }

    } else {
        // password verify failed
        splunkLogger.logInfo({
            name: "splunk: create-delete-workorder-api-password-verify-response-FAIL",
            message: JSON.stringify({
                pluginName: "iam-account-manager-ui",
                serviceName: "create-delete-workorder-api"
            })
        }, offeringId);

        return generateErrorResponse(callback, "invalid_password");
    }
};

export function* cancelWorkOrderAPI({callback, workOrderId, consentPurpose}) {
    const state = yield select();
    const {offeringEnv, offeringId} = state.appState;
    const params = state.appState.queryParams;
    const {userId} = state.userInformation.raw;
    const delegationResponse = yield callDeleteDelegationAPI(userId, offeringEnv, offeringId);
    if (delegationResponse) {
        const consentResponse = yield callPostConsentAPI(consentPurpose, userId, false, offeringEnv, offeringId);
        if (consentResponse) {
            const cancelWorkOrderResponse = yield cancelWorkOrders(offeringEnv, workOrderId, params);

            splunkLogger.logInfo({
                name: "splunk: cancel-workorder-api-response-SUCCESS",
                message: JSON.stringify({
                    pluginName: "iam-account-manager-ui",
                    serviceName: "cancel-workorder-api"
                })
            }, offeringId);

            const response = cancelWorkOrderResponse.response;
            const error = cancelWorkOrderResponse.error;

            const inError = doesErrorExist(response, error);
            callback(!inError, response, error);

            return {response, error};
        }
    } else {

        splunkLogger.logInfo({
            name: "splunk: cancel-workorder-api-response-FAIL",
            message: JSON.stringify({
                pluginName: "iam-account-manager-ui",
                serviceName: "cancel-workorder-api"
            })
        }, offeringId);

        return generateErrorResponse(callback, null);
    }
};
