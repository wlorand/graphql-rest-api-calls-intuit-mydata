import {
    API_REQUEST_TIMEOUT,
    DG_ORCHESTRATOR_BASE_URL,
    PASSWORD_VERIFICATION_BASE_URL,
    CONSENT_SERVICE_BASE_URL,
    DELEGATION_SERVICE_BASE_URL
} from "../../constants";
import {getHandledServiceRequest} from "../ServiceHandler";
import {uuidv4} from "../utils";
import "whatwg-fetch"; // fetch polyfill

export function getRequestInfo(env, apiURL, apiKey, prodApiKey) {
    const environment = ["qal", "prf", "e2e", "prod"].includes(env) ? env : "";
    const API_KEY = ["", "prd", "prod"].includes(environment) ? prodApiKey : apiKey;

    const url = apiURL.replace("{env}",
        ["", "prd", "prod"].includes(env) ? "" : `-${env}`
    );
    const requestHeaders = {
        "Authorization": `Intuit_APIKey intuit_apikey=${API_KEY}, intuit_apikey_version=1.0`,
        "Content-Type": "application/json; charset=utf-8",
        "intuit_originatingip": "127.0.0.1" //TODO this is issue from Delegation access API and needs to be removed as soon as issue is fixed
    };
    return {
        "url": url,
        "header": requestHeaders
    };
}

export function getFFABooleanValue(params) {
    return (params.ffa !== undefined && params.ffa.toLowerCase() === "false") ? false : !!params.ffa;
}

export function callHandleServiceRequest(pluginName, serviceName, requestInfo, bodyParams, methodType) {

    return getHandledServiceRequest(
        {
            pluginName,
            serviceName
        },
        (resolve, reject) => {
            fetch(requestInfo.url, {
                method: methodType,
                body: bodyParams,
                headers: requestInfo.header,
                timeout: API_REQUEST_TIMEOUT,
                cache: "no-cache",
                // dataType: "json", // this may not be a valid param for the fetch api
                credentials: "include"
            })
            // eslint-disable-next-line no-confusing-arrow
            .then(res => {
                const status = res.status;
                res.json()
                    .then((json) => {
                        // Append the statusCode of the API call to json response
                        json.status = status;
                        resolve(json);
                    })
                    .catch(() => resolve({status}));
            })
            .catch(err => reject(err));

        }
    );
}

function injectMockServer(requestInfo, url, params) {

    if (params.dg && params.dg === "local") {
        requestInfo.url = `http://localhost:5000${url}`;
    }
}

export function getWorkOrders(env, userId, params) {

    const query = `{"query":"query getWorkOrders {
  dataGovernanceWorkOrderHolder {
    workOrders(filterBy: \\"authId = '${userId}'\\") {
      edges {
        node {
          requestType
          documentIds
          state
          cancelByUtcTime
          authId
          id
          tid
          scope {
            products
          }
        }
      }
    }
  }
}
","variables":null,"operationName":"getWorkOrders"}`;

    const requestInfo = getRequestInfo(env, DG_ORCHESTRATOR_BASE_URL, "preprdakyrestZkbLSHAe2rHSaxBaxBaamUkI9B6", "");

    injectMockServer(requestInfo, "/getWorkOrder", params);

    return callHandleServiceRequest("iam-account-manager-ui", "mydata-fetch-work-orders", requestInfo, query, "POST");
}

export function createDeleteWorkOrders(env, userId, selectedProducts, params) {

    const mutation = `{"query":"mutation createDeleteWorkOrder {
      createDataregulations_DataGovernanceWorkOrder(input : {
      clientMutationId: \\"1\\",
      dataregulationsDataGovernanceWorkOrder: {
        authId: \\"${userId}\\",
        requestType: DELETE,
        restrictedAssetsOnly: true,
        restrictedAssetIds: [\\"3966562964113123969\\",\\"7065039507743997927\\",\\"1732777548944313613\\"],
        tid: \\"${uuidv4()}\\",
        scope: {
          products: [${selectedProducts}],
          sharedDelete: true,
          retainCompany: true
        },
        ffa: ${getFFABooleanValue(params)}
      }
    }) {
      clientMutationId
      dataregulationsDataGovernanceWorkOrderEdge {
        node {
          id
          authId
          requestType
          state
          tid
          cancelByUtcTime
          scope {
            products
            sharedDelete
            retainCompany
          }
        }
      }
    }
  }",
  "variables":null,
  "operationName":"createDeleteWorkOrder"
  }`;

    const requestInfo = getRequestInfo(env, DG_ORCHESTRATOR_BASE_URL, "preprdakyrestZkbLSHAe2rHSaxBaxBaamUkI9B6", "");

    injectMockServer(requestInfo, "/createDeleteOrder", params);

    return callHandleServiceRequest("iam-account-manager-ui", "mydata-create-delete-work-order", requestInfo, mutation, "POST");
}

export function postConsent(purpose, userId, consented, env) {
    const bodyParams = {
        "consents": [
            {
                "ownerId": userId,
                "ownerType": "USER",
                "consentType": "dg-consents",
                "resource": "data-governance",
                "purpose": purpose,
                "applicationId": "7927478836382766264",
                consented
            },
            {
                "ownerId": userId,
                "ownerType": "USER",
                "consentType": "dg-consents",
                "resource": "dg-consents",
                "purpose": "dg-consents",
                "applicationId": "3748138382259460994",
                consented
            }
        ]
    };
    const requestInfo = getRequestInfo(env, CONSENT_SERVICE_BASE_URL, "preprdakyrestGbIqVqe2UKzO41kS39pNFX7Uajc", "");

    return callHandleServiceRequest("iam-account-manager-ui", "mydata-create-consent", requestInfo, JSON.stringify(bodyParams), "POST");
}

export function postDelegation(userId, env) {
    const bodyParams = {
        "actions": "dg-consents",
        "subjectId": "50000000",
        "resourceOwnerId": userId
    };
    const requestInfo = getRequestInfo(env, DELEGATION_SERVICE_BASE_URL, "preprdakyrestGbIqVqe2UKzO41kS39pNFX7Uajc", "");
    return callHandleServiceRequest("iam-account-manager-ui", "mydata-authorize-delegation", requestInfo, JSON.stringify(bodyParams), "POST");
}

export function deleteDelegation(userId, env) {
    const bodyParams = {
        "actions": "dg-consents",
        "subjectId": "50000000",
        "resourceOwnerId": userId
    };
    const requestInfo = getRequestInfo(env, DELEGATION_SERVICE_BASE_URL, "preprdakyrestGbIqVqe2UKzO41kS39pNFX7Uajc", "");
    return callHandleServiceRequest("iam-account-manager-ui", "mydata-revoke-delegation", requestInfo, JSON.stringify(bodyParams), "DELETE");
}

export function createDownloadWorkOrders(env, userId, selectedProducts, params) {

    const mutation = `{
   "query":"mutation createGetWorkOrder {
  createDataregulations_DataGovernanceWorkOrder(input : {
    clientMutationId: \\"1\\",
    dataregulationsDataGovernanceWorkOrder: {
      authId: \\"${userId}\\",
      requestType: ACCESS,
      restrictedAssetsOnly: true,
      restrictedAssetIds: [\\"3966562964113123969\\",\\"7065039507743997927\\",\\"1732777548944313613\\"],
      tid: \\"${uuidv4()}\\",
      scope: {
        products: [${selectedProducts}],
        sharedDelete: true,
        retainCompany: true
      },
      ffa: ${getFFABooleanValue(params)}
    }
  }) {
    clientMutationId
    dataregulationsDataGovernanceWorkOrderEdge {
      node {
        id
        authId
        requestType
        restrictedAssetsOnly
        restrictedAssetIds
        state
        tid
        cancelByUtcTime
        scope {
          products
          sharedDelete
          retainCompany
        }
      }
    }
  }
}",
   "variables":null,
   "operationName":"createGetWorkOrder"
}`;

    const requestInfo = getRequestInfo(env, DG_ORCHESTRATOR_BASE_URL, "preprdakyrestZkbLSHAe2rHSaxBaxBaamUkI9B6", "");

    injectMockServer(requestInfo, "/createDownloadOrder", params);

    return callHandleServiceRequest("iam-account-manager-ui", "mydata-download-create-work-order", requestInfo, mutation, "POST");
};

export function verifyPassword(userName, password, env) {

    const bodyParams = {
        "username": userName,
        "password": password
    };
    const requestInfo = getRequestInfo(env, PASSWORD_VERIFICATION_BASE_URL, "preprdloGod8GXC0LYSaDSPqgcfw4UnBj8vYAnbq", "");

    return callHandleServiceRequest("iam-account-manager-ui", "mydata-password-verify", requestInfo, JSON.stringify(bodyParams), "POST");
};

export function cancelWorkOrders(env, workOrderId, params) {
    const mutation = `{"query":"mutation updateWorkOrder {
      updateDataregulations_DataGovernanceWorkOrder(input: {
        clientMutationId: \\"1\\",
        dataregulationsDataGovernanceWorkOrder: {
          id: \\"${workOrderId}\\"
          state: CANCELLED,
          ffa: ${getFFABooleanValue(params)}
        }
      }) {
        clientMutationId
        dataregulationsDataGovernanceWorkOrder {
          id
          authId
          requestType
          state
          cancelByUtcTime
          tid
        }
      }
    }","variables":null,"operationName":"updateWorkOrder"}`;

    const requestInfo = getRequestInfo(env, DG_ORCHESTRATOR_BASE_URL, "preprdakyrestZkbLSHAe2rHSaxBaxBaamUkI9B6", "");

    injectMockServer(requestInfo, `/cancelWorkOrder/${workOrderId}`, params);

    return callHandleServiceRequest("iam-account-manager-ui", "mydata-cancel-work-orders", requestInfo, mutation, "POST");
};
