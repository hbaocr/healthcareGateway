const server = MedcontractInfo.gateway_host;
const signed_msg = MedcontractInfo.msg_signed;
const _gasLimit = MedcontractInfo._gasLimit;
const _gasPrice = MedcontractInfo._gasPrice;
const PERMISSION_INFO=["Write Only","Read and Write","Reject-Forbid","Expired Access","Not used","All Access"];
var configheader = {
    headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
    }
};
var signature;
//two first running function to init app
async function on_page_load() {
    if (window.ethereum) {// Modern dapp browsers...
        window.web3 = new Web3(ethereum);
        try {
            await ethereum.enable();  //  // Request account access if needed.Acccounts now exposed     
        } catch (error) {
            console.log(error);
        }
    } else if (window.web3) {//  Legacy dapp browsers...
        window.web3 = new Web3(web3.currentProvider);
    } else {  // Non-dapp browsers...
        console.log('Non-Ethereum browser detected. You should consider trying MetaMask!');
    }
}
function setup_smartcontract() {

    if (web3) { /* use external web3 instance*/
        window.contract = new web3.eth.Contract(MedcontractInfo.abi, MedcontractInfo.address);
    } else {
        window.contract = new this.web3.eth.Contract(MedcontractInfo.abi, MedcontractInfo.address);
    }
    abiDecoder.addABI(MedcontractInfo.abi);// lib for decode transaction receipt.logs
    /**
     *  abidecoder.addABI(abi)
        abidecoder.decodeLogs(txReceipt.logs)
     */
    return window.contract;
}
function authen_request() {
    req_authen_jwt_cookies().then((res) => {
        window.alert(res.data.message);
    })
}

function on_org_fhir_management_menu() {
    //alert('on_org_fhir_management');
    req_authen_jwt_cookies().then((res) => {
        if (res.data.err_code == 0) {
            window.location = server + "/clinics_fhir.html";
        }
        window.alert(res.data.message);
    })
        .catch(console.error);
}

function on_patients_fhir_management_menu() {
    alert('on_patients_fhir_management');
    let link = server + "/fhir_org_update";
    return axios.post(link, { 'a': '1' }, configheader);
}
//create _did from msg
function create_did(sender,msg){
    let _tmp=web3.utils.sha3(msg+''+sender) ;
    let _tmp_acc=web3.eth.accounts.privateKeyToAccount(_tmp);
    return _tmp_acc.address.toLowerCase();
}


//to make sure already overide web3@0.20(built-in by metamask) by web3@1.0
function get_web3_10() {
    if (web3.version.api) {
        window.web3 = new Web3(ethereum);
        setup_smartcontract();
    }

    return window.web3;
}
//post link inclue cookies also
function do_http_post(link, js_obj, header_opt) {
    let req_header = {};
    if (header_opt) {
        req_header = {
            headers: header_opt
        };
    } else {
        req_header = {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            }
        };
    }
    return axios.post(link, js_obj, req_header);
}
function req_authen_jwt_cookies() {
    return eth_personal_sign(signed_msg)
        .then((_signature) => {
            signature = _signature;
            let from = get_selected_addr();
            if (!from) return connect();
            let jsdata = JSON.stringify({
                account: from,
                signed: _signature,
            });
            console.log('signature : ', jsdata);
            let link = server + "/jwt_authen";
            return axios.post(link, jsdata, configheader);
        })
}

function setHTMLTagTextColor(tagId,color){
    document.getElementById(tagId).style.color=color;
}
function setHTMLTag(tagId, info_str) {
    document.getElementById(tagId).innerHTML = info_str;
}
function getHTMLTag(tagId) {
    return document.getElementById(tagId).value;
}
function connect() {
    if (typeof ethereum !== 'undefined') {
        ethereum.enable()
            .catch(console.error)
    }
}
function eth_personal_sign(msg) {
    let from = get_selected_addr();
    if (!from) return connect();
    web3 = get_web3_10();
    return web3.eth.getBlockNumber()
        .then((blockcnt) => {
            let interval = MedcontractInfo.block_interval;
            interval = (interval == 0) ? 20 : interval;
            var nonce = Math.floor(blockcnt / interval);
            let str_msg = msg + ':' + nonce;
            return web3.eth.personal.sign(str_msg, from, "");//sign through metamask
        })
}
function get_selected_addr() {
    return web3.currentProvider.selectedAddress;
}

function wait_for_receipt(txhash, timeoutsec, cb, periodsec = 5) {
    let err = null;
    let result = null;
    if (timeoutsec > 0) {
        timeoutsec = timeoutsec - periodsec;
    } else {
        err = 'timeout';
        cb(err, result);
        return;
    }
    web3.eth.getTransactionReceipt(txhash, (error, res) => {
        if (error) {
            cb(error, result);
        } else {
            if (res) {
                let receipt = abiDecoder.decodeLogs(res.logs);
                let ret = {
                    raw: res,
                    receipt: receipt,
                }
                cb(null, ret);
            } else {
                setTimeout(() => {
                    wait_for_receipt(txhash, timeoutsec, cb, periodsec);
                }, periodsec * 1000);
            }
        }
    })
}
//================Smartcontract Handle========================
function get_fee() {
    let _fromaddr = web3.currentProvider.selectedAddress;
    return contract.methods.get_fee().call({ from: _fromaddr });
}
function org_insert_info(org_info, fee_wei, timeoutsec = 120) {
    return new Promise((resolve, reject) => {
        let _fromaddr = web3.currentProvider.selectedAddress;
        let opt = {
            from: _fromaddr,
            gas: _gasLimit,//gas limitted
            gasPrice: _gasPrice, // default gas price in wei, 20 gwei in this case
            value: fee_wei,//this.web3.utils.toBN(0)//no need transfer with value of ETH
        }
        contract.methods.org_insert_info(org_info).send(opt)
            .on('transactionHash', function (hash) {
                console.log('tx hash : ', hash);
                wait_for_receipt(hash, timeoutsec, (err, ret) => {
                    if (err) {
                        console.error(err);
                        reject(err);
                    } else {
                        let res = ret.raw;
                        let evnt = {
                            receipt: abiDecoder.decodeLogs(res.logs),
                            transactionHash: res.transactionHash,
                            gasUsed: res.cumulativeGasUsed,
                            blocknum: res.blockNumber
                        };
                        console.log(evnt);
                        resolve(evnt);
                    }
                });
            })
    });
}
function org_get_info(_orgId) {
    let _fromaddr = web3.currentProvider.selectedAddress;
    return contract.methods.org_get_info(_orgId).call({ from: _fromaddr });
}

function org_insert_pat_did(_patID,_did,_desc,fee_wei,timeoutsec=120){
    return new Promise((resolve, reject) => {
        let _fromaddr = web3.currentProvider.selectedAddress;
        let opt = {
            from: _fromaddr,
            gas: _gasLimit,//gas limitted
            gasPrice: _gasPrice, // default gas price in wei, 20 gwei in this case
            value: fee_wei,//this.web3.utils.toBN(0)//no need transfer with value of ETH
        }
        contract.methods.org_insert_pat_did(_patID,_did,_desc).send(opt)
            .on('transactionHash', function (hash) {
                console.log('tx hash : ', hash);
                wait_for_receipt(hash, timeoutsec, (err, ret) => {
                    if (err) {
                        console.error(err);
                        reject(err);
                    } else {
                        let res = ret.raw;
                        let evnt = {
                            receipt: abiDecoder.decodeLogs(res.logs),
                            transactionHash: res.transactionHash,
                            gasUsed: res.cumulativeGasUsed,
                            blocknum: res.blockNumber
                        };
                        console.log(evnt);
                        resolve(evnt);
                    }
                });
            })
    });

}

function org_read_pat_did(_oID,_pID,fee_wei=0,timeoutsec=120){
    return new Promise((resolve, reject) => {
        let _fromaddr = _oID;//web3.currentProvider.selectedAddress;
        let opt = {
            from: _fromaddr,
            gas: _gasLimit,//gas limitted
            gasPrice: _gasPrice, // default gas price in wei, 20 gwei in this case
            value: fee_wei,//this.web3.utils.toBN(0)//no need transfer with value of ETH
        }
        contract.methods.org_read_pat_did(_fromaddr,_pID).send(opt)
            .on('transactionHash', function (hash) {
                console.log('tx hash : ', hash);
                wait_for_receipt(hash, timeoutsec, (err, ret) => {
                    if (err) {
                        console.error(err);
                        reject(err);
                    } else {
                        let res = ret.raw;
                        let evnt = {
                            receipt: abiDecoder.decodeLogs(res.logs),
                            transactionHash: res.transactionHash,
                            gasUsed: res.cumulativeGasUsed,
                            blocknum: res.blockNumber
                        };
                        console.log(evnt);
                        resolve(evnt);
                    }
                });
            })
    });
}

function pat_insert_info(pat_info, fee_wei, timeoutsec = 120) {
    return new Promise((resolve, reject) => {
        let _fromaddr = web3.currentProvider.selectedAddress;
        let opt = {
            from: _fromaddr,
            gas: _gasLimit,//gas limitted
            gasPrice: _gasPrice, // default gas price in wei, 20 gwei in this case
            value: fee_wei,//this.web3.utils.toBN(0)//no need transfer with value of ETH
        }
        contract.methods.pat_insert_info(pat_info).send(opt)
            .on('transactionHash', function (hash) {
                console.log('tx hash : ', hash);
                wait_for_receipt(hash, timeoutsec, (err, ret) => {
                    if (err) {
                        console.error(err);
                        reject(err);
                    } else {
                        let res = ret.raw;
                        let evnt = {
                            receipt: abiDecoder.decodeLogs(res.logs),
                            transactionHash: res.transactionHash,
                            gasUsed: res.cumulativeGasUsed,
                            blocknum: res.blockNumber
                        };
                        console.log(evnt);
                        resolve(evnt);
                    }
                });
            })
    });
}
function pat_get_info(_pID) {
    let _fromaddr = web3.currentProvider.selectedAddress;
    return contract.methods.pat_get_info(_pID).call({ from: _fromaddr });
}

function org_check_permission(oID,_pID,fee_wei=0,timeoutsec=120){
    let _fromaddr = web3.currentProvider.selectedAddress;
    return contract.methods.org_check_permission(oID,_pID).call({ from: _fromaddr });
}

function pat_allow_org(_oID,_permsion,_expiredTime,fee_wei=0,timeoutsec=120){
    return new Promise((resolve, reject) => {
        let _fromaddr = web3.currentProvider.selectedAddress;
        let opt = {
            from: _fromaddr,
            gas: _gasLimit,//gas limitted
            gasPrice: _gasPrice, // default gas price in wei, 20 gwei in this case
            value: fee_wei,//this.web3.utils.toBN(0)//no need transfer with value of ETH
        }
        contract.methods.pat_allow_org(_oID,_permsion,_expiredTime).send(opt)
            .on('transactionHash', function (hash) {
                console.log('tx hash : ', hash);
                wait_for_receipt(hash, timeoutsec, (err, ret) => {
                    if (err) {
                        console.error(err);
                        reject(err);
                    } else {
                        let res = ret.raw;
                        let evnt = {
                            receipt: abiDecoder.decodeLogs(res.logs),
                            transactionHash: res.transactionHash,
                            gasUsed: res.cumulativeGasUsed,
                            blocknum: res.blockNumber
                        };
                        console.log(evnt);
                        resolve(evnt);
                    }
                });
            })
    });

}
