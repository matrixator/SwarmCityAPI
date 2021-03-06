'use strict';

const logger = require('../logs')(module);

/**
 * A service that collects all interactions with LevelDb
 */
class DBService {
    /**
     * Create a DBService
     * @param   {levelDb}   db      The connection to leveldb
     * @param   {Object}    options Contains options
     * @todo    Ensure all options are set
     */
    constructor(db, options) {
        this.db = db;
        this.options = options || {
            'parameterscontract': '',
            'parameterscontractstartblock': '',
        };
    }

    /**
     * Returns the cached data for a given
     *
     * @param      {String}   shortCode    The ShortCode
     * @return     {Promise}  resolves with a JSON object, rejects with an Error object
     */
    readShortCode(shortCode) {
        logger.info('readShortCode start %s', shortCode);
        return new Promise((resolve, reject) => {
            let key = 'shortcode-' + shortCode;
            this.db.get(key).then((val) => {
                // so we have data..
                try {
                    let data = JSON.parse(val);
                    logger.info('We found data in DB %j', data);
                    // is the code still valid ? If it has not expired, return the data.
                    if (data.validUntil && data.validUntil >= (new Date).getTime()) {
                        logger.info('data is OK');
                        return resolve(data.payload);
                    }
                    logger.info('data has expired');
                    return reject();
                } catch (e) {
                    // can't read the data.
                    return reject();
                }
            }).catch((err) => {
                if (err.notFound) {
                    logger.error('key %s not found (yet) in DB.', key);
                    return reject(err);
                }
                return reject(err);
            });
        });
    }

    /**
     * saves ShortCode payload in DB
     *
     * @param      {string}   shortCode  The ShortCode
     * @param      {Number}   validity   The validity of this data in ms
     * @param      {Object}   payload    The payload to store
     * @return     {Promise}  resolves when ready..
     */
    saveDataToShortCode(shortCode, validity, payload) {
        return new Promise((resolve, reject) => {
            let key = 'shortcode-' + shortCode;
            let val = {
                shortCode: shortCode,
                validUntil: (new Date).getTime() + validity,
                payload: payload,
            };
            logger.info('Storing %j at %s', val, key);
            this.db.put(key, JSON.stringify(val)).then(() => {
                resolve();
            }).catch((err) => {
                logger.error(err);
                return reject(err);
            });
        });
    }

    /**
     * Delete a ShortCode
     *
     * @param   {String}    shortCode   ShortCode
     * @return  {Promise}   Promise
     */
    deleteShortCode(shortCode) {
        let key = 'shortcode-' + shortCode;
        logger.debug('Deleting %s', key);
        return this.db.del(key);
    }

    /**
     * get all ShortCodes from the database
     *
     * @return      {stream.Readable}   A readable stream of the ShortCodes
     */
    getShortCodes() {
        return this.db.createReadStream({
            gte: 'shortcode-',
        });
    }

    /**
     * Returns last processed block of the parameters contract
     * ( or the deployment block if not initialized yet...)
     *
     * @return     {Promise}  The last block.
     */
    getLastBlock() {
        return new Promise((resolve, reject) => {
            let key = 'lastblock-' + this.options.parameterscontract;
            this.db.get(key).then((val) => {
                resolve(parseInt(val));
            }).catch((err) => {
                if (err.notFound) {
                    logger.info(
                        'no lastblock in DB. Falling back to the startblock %i',
                        this.options.parameterscontractstartblock
                    );
                    resolve(parseInt(this.options.parameterscontractstartblock));
                }
                reject(new Error(err));
            });
        });
    }

    /**
     * Sets the last block.
     *
     * @param      {Number}     blockNumber  The block number
     * @return     {Promise}    promise
     */
    setLastBlock(blockNumber) {
        return this.db.put('lastblock-' + this.options.parameterscontract, blockNumber);
    }

    /**
     * Set the hashtagindexer to synced
     *
     * @param       {Boolean}   synced  Is it synced or not?
     * @return      {Promise}   promise
     */
    setHashtagIndexerSynced(synced) {
        return this.db.put('hashtagindexer-synced', synced);
    }

    /**
     * Set the hashtaglist
     *
     * @param       {String}    list    The hashtaglist
     * @return      {Promise}   promise
     */
    setHashtagList(list) {
        return this.db.put(this.options.parameterscontract + '-hashtaglist', list);
    }

    /**
     * Get the hashtaglist
     *
     * @return      {Promise}   promise
     */
    getHashtagList() {
        return new Promise((resolve, reject) => {
            let key = this.options.parameterscontract + '-hashtaglist';
            this.db.get(key).then((val) => {
                try {
                    let hashtags = JSON.parse(val);
                    // this is debug stuff
                    hashtags.push({
                        name: 'Random ' + Math.floor(Math.random() * 10 + 5),
                        deals: Math.floor(Math.random() * 10 + 5),
                        id: '1c9v87bc98v7a',
                        commission: 0.05,
                        maintainer: '0x369D787F3EcF4a0e57cDfCFB2Db92134e1982e09',
                        contact: [{
                            name: 'hashtagman2@gmail.com',
                            link: 'mailto:hashtagman2@gmail.com',
                        }, {
                            name: '@hashtag2 (Twitter)',
                            link: 'http://twitter.com/@hashtag2',
                        }],
                    });
                    resolve(hashtags);
                } catch (e) {
                    logger.info('Returning empty hashtag list');
                    logger.error('Cannot parse hashtag data from DB. Data: %s. Error: %j', val, e);
                    resolve([]);
                }
            }).catch((err) => {
                logger.error(JSON.stringify(err));
                if (err.notFound) {
                    logger.error('key %s not found (yet) in DB.', key);
                    logger.info('Returning empty hashtag list');
                    resolve([]);
                }
                reject(new Error(err));
            });
        });
    }

    /**
     * Delete a user's transaction history
     *
     * @param   {String}    pubkey      User's pubkey
     * @return  {Promise}   Promise
     */
    deleteTransactionHistory(pubkey) {
        let key = pubkey + '-transactionHistory';
        return this.db.del(key);
    }

    /**
     * Save a user's transaction history.
     *
     * @param   {String}    pubkey      User's pubkey
     * @param   {Number}    endBlock    Last block that was included in this
     *                                  history.
     * @param   {Object}    transactionHistory  User's transaction history
     * @return  {Promise}   promise
     */
    setTransactionHistory(pubkey, endBlock, transactionHistory) {
        let key = pubkey + '-transactionHistory';
        let val = {
            pubkey: pubkey,
            lastUpdate: (new Date).getTime(),
            lastRead: (new Date).getTime(),
            endBlock: endBlock,
            transactionHistory: transactionHistory,
        };
        logger.info('Storing %j at %s', val, key);
        return this.db.put(key, JSON.stringify(val));
    }

    /**
     * Get an empty txHistory.
     *
     * @param   {String}    pubkey  User's pubkey
     * @return  {Object}    Default txHistory
     */
    _getEmptyTxHistory(pubkey) {
        return {
            pubkey: pubkey,
            lastUpdate: (new Date).getTime(),
            lastRead: (new Date).getTime(),
            endBlock: process.env.SWTSTARTBLOCK - 1,
            transactionHistory: [],
        };
    }

    /**
     * Get a user's transactionHistory and some metadata.
     *
     * @param   {String}    pubkey  User's pubkey
     * @return  {Promise}   A promise that resolves to an object containing a
     *                      user's transactionHistory and some metadata, such as
     *                      the time it was last updated. Or rejects when an
     *                      error occurs.
     */
    getTransactionHistory(pubkey) {
        logger.debug('Getting history for %s', pubkey);
        return new Promise((resolve, reject) => {
            let key = pubkey + '-transactionHistory';
            this.db.get(key).then((val) => {
                logger.debug('Going to parse %s', val);
                let history;
                try {
                    history = JSON.parse(val) || this._getEmptyTxHistory(pubkey);
                } catch (e) {
                    logger.error(
                        'Cannot parse transactionHistory data from DB for %s. Data: %s. Error: %j',
                        pubkey,
                        val,
                        e
                    );
                    history = this._getEmptyTxHistory(pubkey);
                }
                history.lastRead = (new Date).getTime();
                this.db.put(key, JSON.stringify(history)).then(() => {
                    logger.debug(history);
                    resolve(history);
                }).catch((err) => {
                    logger.error('Could not update lastRead value because: %s', err);
                    logger.debug(history);
                    resolve(history);
                });
            }).catch((error) => {
                logger.error(JSON.stringify(error));
                if (error.notFound) {
                    logger.error('key %s not found (yet) in DB.', key);
                    resolve(this._getEmptyTxHistory(pubkey));
                }
                reject(new Error(error));
            });
        });
    }
}

module.exports = {
    'DBService': DBService,
};
