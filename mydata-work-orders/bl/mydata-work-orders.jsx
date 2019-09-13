import {get} from "lodash-no-global";
import {MYDATA_WO_STATUS} from "../../constants";

export function formatGetWorkOrdersResponse(response) {

    const workOrdersList = get(response, "data.dataGovernanceWorkOrderHolder.workOrders.edges", []);

    if (workOrdersList.length === 0) {
        return {
            "status": MYDATA_WO_STATUS.NONE,
            "downloadOrder": null,
            "deleteOrder": null
        };
    } else {

        //MyData work order state
        const MYDATA_API_WORK_ORDER_STATE = {

            WO_CANCELLABLE: {
                QUEUED: "QUEUED",
                PENDING: "PENDING",
                LEGAL_HOLDS_CHECK_IN_PROGRESS: "LEGAL_HOLDS_CHECK_IN_PROGRESS",
                DELETE_CHECK_PENDING: "DELETE_CHECK_PENDING",
                DELETE_CHECK_IN_PROGRESS: "DELETE_CHECK_IN_PROGRESS",
                IN_REMORSE_PERIOD: "IN_REMORSE_PERIOD"

            },

            WO_NON_CANCELLABLE: {
                LEGAL_HOLDS_CHECK_FAILED: "LEGAL_HOLDS_CHECK_FAILED",
                DELETE_CHECK_FAILED: "DELETE_CHECK_FAILED",
                INTUIT_DELETE_CHECK_IN_PROGRESS: "INTUIT_DELETE_CHECK_IN_PROGRESS",
                INTUIT_DELETE_CHECK_OOSLA: "INTUIT_DELETE_CHECK_OOSLA",
                IN_PROGRESS: "IN_PROGRESS",
                IDENTITY_DELETE_PENDING: "IDENTITY_DELETE_PENDING",
                PROCESSED: "PROCESSED",
                OOSLA: "OOSLA" //DM processing for > 10 Days
            },

            COMPRESSION_PENDING: "COMPRESSION_PENDING",
            COMPRESSION_COMPLETE: "COMPRESSION_COMPLETE",
            COMPRESSION_FAILED: "COMPRESSION_FAILED",
            COMPRESSION_OOSLA: "COMPRESSION_OOSLA"
        };

        const REQUEST_TYPE = {
            "DELETE": "DELETE",
            "ACCESS": "ACCESS"
        };

        const DELETE_STATE = [
            MYDATA_API_WORK_ORDER_STATE.WO_CANCELLABLE.QUEUED,
            MYDATA_API_WORK_ORDER_STATE.WO_CANCELLABLE.PENDING,
            MYDATA_API_WORK_ORDER_STATE.WO_CANCELLABLE.LEGAL_HOLDS_CHECK_IN_PROGRESS,
            MYDATA_API_WORK_ORDER_STATE.WO_NON_CANCELLABLE.LEGAL_HOLDS_CHECK_FAILED,
            MYDATA_API_WORK_ORDER_STATE.WO_NON_CANCELLABLE.DELETE_CHECK_PENDING,
            MYDATA_API_WORK_ORDER_STATE.WO_CANCELLABLE.DELETE_CHECK_IN_PROGRESS,
            MYDATA_API_WORK_ORDER_STATE.WO_NON_CANCELLABLE.DELETE_CHECK_FAILED,
            MYDATA_API_WORK_ORDER_STATE.WO_CANCELLABLE.IN_REMORSE_PERIOD,
            MYDATA_API_WORK_ORDER_STATE.WO_NON_CANCELLABLE.INTUIT_DELETE_CHECK_IN_PROGRESS,
            MYDATA_API_WORK_ORDER_STATE.WO_NON_CANCELLABLE.INTUIT_DELETE_CHECK_OOSLA,
            MYDATA_API_WORK_ORDER_STATE.WO_NON_CANCELLABLE.IN_PROGRESS,
            MYDATA_API_WORK_ORDER_STATE.WO_NON_CANCELLABLE.IDENTITY_DELETE_PENDING,
            MYDATA_API_WORK_ORDER_STATE.WO_NON_CANCELLABLE.OOSLA
        ];

        const DOWNLOAD_STATE = [
            ...DELETE_STATE,
            MYDATA_API_WORK_ORDER_STATE.WO_NON_CANCELLABLE.PROCESSED,
            MYDATA_API_WORK_ORDER_STATE.COMPRESSION_COMPLETE,
            MYDATA_API_WORK_ORDER_STATE.COMPRESSION_PENDING,
            MYDATA_API_WORK_ORDER_STATE.COMPRESSION_FAILED,
            MYDATA_API_WORK_ORDER_STATE.COMPRESSION_OOSLA
        ];

        const PRODUCT_NAME_MAPPING = {
            TURBO_TAX: "TurboTax",
            TURBO: "Turbo",
            MINT: "Mint"
        };

        let downloadOrder;
        let deleteOrder;

        workOrdersList.forEach(order => {
            const requestType = get(order, "node.requestType", "");
            const state = get(order, "node.state", "");
            const node = get(order, "node", "");

            if (requestType === REQUEST_TYPE.DELETE && DELETE_STATE.includes(state)) {
                node.cancelByUtcTime = new Date(node.cancelByUtcTime);

                //Make sure we always get the latest one
                if (!deleteOrder || deleteOrder.cancelByUtcTime < node.cancelByUtcTime) {
                    deleteOrder = node;
                }

            } else if (requestType === REQUEST_TYPE.ACCESS && DOWNLOAD_STATE.includes(state)) {
                node.cancelByUtcTime = new Date(node.cancelByUtcTime);

                //Make sure we always get the latest one
                if (!downloadOrder || downloadOrder.cancelByUtcTime < node.cancelByUtcTime) {
                    downloadOrder = node;
                }
            }

            node.scope.products = node.scope.products.map(product => {
                return {productName: PRODUCT_NAME_MAPPING[product], productValue: product};
            });
        });

        //mapping the status
        let status = MYDATA_WO_STATUS.NONE;
        if (downloadOrder && deleteOrder) {
            if (downloadOrder.cancelByUtcTime < deleteOrder.cancelByUtcTime) { //delete is the latest
                if (downloadOrder.state === MYDATA_API_WORK_ORDER_STATE.COMPRESSION_COMPLETE) {
                    status =  MYDATA_API_WORK_ORDER_STATE.WO_CANCELLABLE[deleteOrder.state] ? MYDATA_WO_STATUS.DELETE_IN_PROGRESS_DOWNLOAD_READY : MYDATA_WO_STATUS.DELETE_BLOCK_IN_PROGRESS_DOWNLOAD_READY;
                } else {
                    status =  MYDATA_API_WORK_ORDER_STATE.WO_CANCELLABLE[deleteOrder.state] ? MYDATA_WO_STATUS.DELETE_IN_PROGRESS : MYDATA_WO_STATUS.DELETE_BLOCK_IN_PROGRESS;
                }
            } else {
                status = downloadOrder.state === MYDATA_API_WORK_ORDER_STATE.COMPRESSION_COMPLETE ? MYDATA_WO_STATUS.DOWNLOAD_READY : MYDATA_WO_STATUS.DOWNLOAD_IN_PROGRESS;
            }
        } else if (deleteOrder) {
            status = MYDATA_API_WORK_ORDER_STATE.WO_CANCELLABLE[deleteOrder.state] ? MYDATA_WO_STATUS.DELETE_IN_PROGRESS : MYDATA_WO_STATUS.DELETE_BLOCK_IN_PROGRESS;

        } else if (downloadOrder) {
            status = downloadOrder.state === MYDATA_API_WORK_ORDER_STATE.COMPRESSION_COMPLETE ? MYDATA_WO_STATUS.DOWNLOAD_READY : MYDATA_WO_STATUS.DOWNLOAD_IN_PROGRESS;
        }

        const res = {
            "status": status,
            "downloadOrder": downloadOrder,
            "deleteOrder": deleteOrder
        };

        return res;
    }
}

export function formatProductList(productList, selectedFlagName) {
    return productList.filter((product) => product[selectedFlagName])
        .map((product) => `\\"${product.productValue}\\"`)
        .join(",");
}

/**
 * This function is to sort the products for rendering order based on the UX requirements
 * @param {Array} rawProductList: Initial list of products. (eventually from ProductsIUse API Call)
 * @param {String} aid: (optional) aid param from state that signifies referring product site
 * @return {Array} finalProductList: a new sorted array of products ready for rendering
 */

export const rawProductList = [
    {
        productName: "TurboTax",
        productId: "tt",
        productValue: "TURBO_TAX",
        productDeleteDesc: "You'll lose access to your electronic tax returns, W-2 records and audit assistance.",
        productDownloadDesc: "You'll get your tax return data, filing info, filing dates and return status, as well as your order history and personal profile data."
    },
    {
        productName: "Turbo",
        productId: "tb",
        productValue: "TURBO",
        productDeleteDesc: "You'll lose access to 24/7 credit monitoring and your real-time debt-to-income ratio.",
        productDownloadDesc: "You'll get your personal profile data, tax return and refund information, and any personalized financial advice we provided."
    },
    {
        productName: "Mint",
        productId: "mt",
        productValue: "MINT",
        productDeleteDesc: "You'll lose access to your budgets, categorized spending history and goal tracking.",
        productDownloadDesc: "You'll get your transaction and bill payment histories, budgets, financial goals, credit report, any customized offers we provided, and your personal profile data. "
    }
];

export function sortProductList(productList, aid) {
    let finalProductList = [];
    // eslint-disable-next-line no-confusing-arrow
    const sortedProductList = productList.sort((a, b) => a.productName > b.productName ? 1 : -1);
    if (!aid) {
        finalProductList = sortedProductList;
    } else {
        // grab the aid product, remove it from the list and create a new array with the aid product listed first
        const aidProduct = sortedProductList.filter(product => product.productId === aid);
        const productListNoAid = sortedProductList.filter(product => product.productId !== aid);
        finalProductList = [...aidProduct, ...productListNoAid];
    }
    return finalProductList;
}

export function doesErrorExist(response, error) {
    return !!error || (response.errors && response.errors.length > 0) || response.error || (response.status < 200 || response.status > 300);
}
