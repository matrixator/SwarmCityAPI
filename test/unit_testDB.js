'use strict';

const should = require('should');
const sinon = require('sinon');

const DBService= require('../services/db').DBService;


describe('services/db/DBService', function() {
    describe('readShortCode()', function() {
        it('should reject on DB lookup failure', function() {
            let mockDB = {
                get: function(key) {
                    return Promise.reject('Unknown error.');
                },
            };
            let dbService = new DBService(mockDB);

            return dbService
                    .readShortCode('shortCodeString')
                    .then(() => {
                        return Promise.reject('Expected rejection');
                    })
                    .catch((e) => {
                        return Promise.resolve(e);
                    })
                    .then((err) => {
                        should(err).be.ok;
                    });
        });

        it('should reject on DB entry not found', function() {
            let mockDB = {
                get: function(key) {
                    return Promise.reject({
                        'notFound': true,
                    });
                },
            };
            let dbService = new DBService(mockDB);

            return dbService
                    .readShortCode('shortCodeString')
                    .then(() => {
                        return Promise.reject('Expected rejection');
                    })
                    .catch((e) => {
                        return Promise.resolve(e);
                    })
                    .then((err) => {
                        should(err).be.ok;
                    });
        });
    });

    describe('setLastBlock()', function() {
        it('should put correct information in the database', function() {

            let mockDB = {
                put: function(key) {},
            };

            let spy = sinon.stub(mockDB, 'put').returns(Promise.resolve('thing'));

            let dbService = new DBService(
                mockDB,
                {
                    'parameterscontract': 'mockContract',
                }
            );

            let promise = dbService.setLastBlock(15);
            let key = 'lastblock-mockContract';
            should(spy.calledWith(key, 15)).be.ok;
        });
    });
});
