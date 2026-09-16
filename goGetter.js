var fetch = require('node-fetch');
var auchan = require('./markets/auchan');
var continente = require('./markets/continente');
var pingoDoce = require('./markets/pingoDoce');
var intermarche = require('./markets/intermarche');

async function goGetter() {

    //get categories of all
    console.log("Getting categories of stores")
    var _data = [];
    var _categoriesAuchan = await auchan.getAllCategories();
    var _categoriesContinente = await continente.getAllCategories();
    var _categoriesPingoDoce = await pingoDoce.getAllCategories();
    var _categoriesIntermarche = await intermarche.getAllCategories();
    _data.push({ StoreId: 1, StoreName: 'Auchan', Categories: _categoriesAuchan });
    _data.push({ StoreId: 2, StoreName: 'Continente', Categories: _categoriesContinente });
    _data.push({ StoreId: 3, StoreName: 'Pingo Doce', Categories: _categoriesPingoDoce });
    _data.push({ StoreId: 4, StoreName: 'Intermarché', Categories: _categoriesIntermarche });

    //get last category index for all stores
    for (let index = 0; index < _data.length; index++) {
        const _store = _data[index];

        var _currentCategory = await fetch('http://lisie.app/api/online/GetStoreGetterLastCategory?storeId=' + _store.StoreId);
        var _currentCategoryText = await _currentCategory.text();

        //get current category index
        var _startIndex = 0;
        if (_currentCategoryText) {
            for (let y = 0; y < _store.Categories.length; y++) {
                var _categoryUrl = _store.Categories[y];

                if (_store.StoreId === 3) {
                    _categoryUrl = _categoryUrl.id
                }

                if (_categoryUrl == _currentCategoryText) {
                    console.log("found last category, starting from there", _currentCategoryText);
                    _startIndex = y + 1;
                    break;
                }
            }
        }
        _store.CategoryStartIndex = _startIndex;
        _store.CategoryLast = _currentCategoryText;
    }


    while (true) {
        for (let index = 0; index < _data.length; index++) {
            try {


                const _store = _data[index];

                if (_store.Categories.length == 0) {
                    continue;
                }
                //Check if reached the end of categories for this store
                if (_store.CategoryStartIndex == _store.Categories.length) {
                    continue;
                }
                var _currentCategory = _store.Categories[_store.CategoryStartIndex];

                if (_store.StoreId === 3) {
                    console.log("Getting " + _store.StoreName + " products of category " + _currentCategory.slug + " with id " + _currentCategory.id);
                } else {
                    console.log("Getting " + _store.StoreName + " products of category " + _currentCategory);

                }
                //get products
                var productsRequestedForAdd = await getStoreProducts(_store.StoreId, _currentCategory);

                console.log("found ", productsRequestedForAdd.length);

                if (productsRequestedForAdd) {
                    var jsonDataObj = {
                        StoreId: _store.StoreId,
                        OnlineProductIds: productsRequestedForAdd,
                    };
                    // var response = await fetch('http://localhost:4430/api/products/GetOnlineProductIdsNotFound', {
                    var response = await fetch('https://lisie.app/api/products/GetOnlineProductIdsNotFound', {
                        method: 'POST',
                        body: JSON.stringify(jsonDataObj),
                        headers: { 'Content-Type': 'application/json' }
                    });
                    var _json = await response.json();
                    console.log("Adding products - ", _json.length);
                    console.log(_json);

                    productsRequestedForAdd = await addStoreProducts(_store.StoreId, _json);
                }
                //get new products
                //add new products

                //Remove from list

                _store.Categories.splice(_store.CategoryStartIndex, 1);
                if (_store.StoreId === 3) {
                    _currentCategory = _currentCategory.id
                }
                await fetch('http://lisie.app/api/online/SetStoreGetterLastCategory?storeId=' + _store.StoreId + '&lastCategory=' + _currentCategory);
            } catch (error) {
                console.log(error);
            }
        }

        //check if all ended, if yes break
        var _allEnded = true;
        for (let index = 0; index < _data.length; index++) {
            _store = _data[index];
            if (_store.CategoryStartIndex < _store.Categories.length) {
                _allEnded = false;
                break;
            }
        }

        if (_allEnded) {
            break;
        }
        // if(_break) break;
    }
}

async function getStoreProducts(storeId, categoryUrl) {
    switch (storeId) {
        case 1:
            return await auchan.getNewProducts(categoryUrl);
        case 2:
            return await continente.getNewProducts(categoryUrl);
        case 3:
            return await pingoDoce.getNewProducts(categoryUrl);
        case 4:
            return await intermarche.getNewProducts(categoryUrl);
        default:
            break;
    }
}

async function addStoreProducts(storeId, productsOnlineId) {
    switch (storeId) {
        case 1:
            return await auchan.addNewProducts(productsOnlineId);
        case 2:
            return await continente.addNewProducts(productsOnlineId);
        case 3:
            return await pingoDoce.addNewProducts(productsOnlineId);
        case 4:
            return await intermarche.addNewProducts(productsOnlineId);
        default:
            break;
    }
}

async function auchanGetNewProducts() {
    console.log("fetching all Auchan categories");
    var _auchanCategories = await auchan.getAllCategories();
    console.log("fetching last category, to continue where we were");
    var _currentAuchanCategory = await fetch('http://lisie.app/api/online/GetStoreGetterLastCategory?storeId=1');
    // var _currentAuchanCategory = await fetch('http://localhost:4430/api/online/GetStoreGetterLastCategory?storeId=1');
    var _currentAuchanCategoryText = await _currentAuchanCategory.text();
    var productsRequestedForAdd = null;

    //get current category index
    var _startIndex = 0;
    if (_currentAuchanCategoryText) {
        for (let index = 0; index < _auchanCategories.length; index++) {
            const _categoryUrl = _auchanCategories[index];
            if (_categoryUrl == _currentAuchanCategoryText) {
                console.log("found last category, starting from there", _currentAuchanCategory);
                _startIndex = index + 1;
                break;
            }
        }
    }

    for (let index = _startIndex; index < _auchanCategories.length; index++) {
        const _categoryUrl = _auchanCategories[index];
        console.log("fetching proucts of category - ", _categoryUrl);
        // productsRequestedForAdd = await auchan.getNewProducts(page, _categoryUrl);
        productsRequestedForAdd = await auchan.getNewProducts(_categoryUrl);
        console.log("found ", productsRequestedForAdd.length);

        if (productsRequestedForAdd) {
            var jsonDataObj = {
                StoreId: 1,
                OnlineProductIds: productsRequestedForAdd,
            };
            // var response = await fetch('http://localhost:4430/api/products/GetOnlineProductIdsNotFound', {
            var response = await fetch('https://lisie.app/api/products/GetOnlineProductIdsNotFound', {
                method: 'POST',
                body: JSON.stringify(jsonDataObj),
                headers: { 'Content-Type': 'application/json' }
            });
            var _json = await response.json();
            console.log("Adding products - ", _json.length);
            console.log(_json);

            productsRequestedForAdd = await auchan.addNewProducts(_json);
        }
        console.log("finished Auchan category, saving last category to server");
        var _currentAuchanCategory = await fetch('http://lisie.app/api/online/SetStoreGetterLastCategory?storeId=1&lastCategory=' + _categoryUrl);
    }
}
async function continenteGetNewProducts() {
    console.log("fetching all Continente categories");
    var _categories = await continente.getAllCategories();
    console.log("fetching last category, to continue where we were");
    var _currentCategory = await fetch('https://lisie.app/api/online/GetStoreGetterLastCategory?storeId=2');
    // var _currentCategory = await fetch('http://localhost:4430/api/online/GetStoreGetterLastCategory?storeId=2');
    var _currentCategoryText = await _currentCategory.text();
    var productsRequestedForAdd = null;

    //get current category index
    var _startIndex = 0;
    if (_currentCategoryText) {
        for (let index = 0; index < _categories.length; index++) {
            const _categoryUrl = _categories[index];
            if (_categoryUrl == _currentCategoryText) {
                console.log("found last category, starting from there", _currentCategoryText);
                _startIndex = index + 1;
                break;
            }
        }
    }

    for (let index = _startIndex; index < _categories.length; index++) {
        const _categoryUrl = _categories[index];
        console.log("fetching proucts of category - ", _categoryUrl);
        productsRequestedForAdd = await continente.getNewProducts(_categoryUrl);
        console.log("found ", productsRequestedForAdd.length);
        if (productsRequestedForAdd) {
            var jsonDataObj = {
                StoreId: 2,
                OnlineProductIds: productsRequestedForAdd,
            };

            // var response = await fetch('http://localhost:4430/api/products/GetOnlineProductIdsNotFound', {
            var response = await fetch('https://lisie.app/api/products/GetOnlineProductIdsNotFound', {
                method: 'POST',
                body: JSON.stringify(jsonDataObj),
                headers: { 'Content-Type': 'application/json' }
            });
            var _json = await response.json();
            // console.log(_json.length);            
            console.log("Adding products - ", _json.length);
            console.log(_json);


            productsRequestedForAdd = await continente.addNewProducts(_json);
        }
        console.log("finished Continente category, saving last category to server");
        // var _setCurrentCategory = await fetch('http://localhost:4430/api/online/SetStoreGetterLastCategory?storeId=2&lastCategory=' + _categoryUrl);
        var _setCurrentCategory = await fetch('https://lisie.app/api/online/SetStoreGetterLastCategory?storeId=2&lastCategory=' + _categoryUrl);
    }
}
async function pingoDoceGetNewProducts() {
    console.log("fetching all Pingo Doce categories");
    var _categories = await pingoDoce.getAllCategories();
    console.log("fetching last category, to continue where we were");
    var _currentCategory = await fetch('https://lisie.app/api/online/GetStoreGetterLastCategory?storeId=3');
    var _currentCategoryText = await _currentCategory.text();
    var productsRequestedForAdd = null;

    //get current category index
    var _startIndex = 0;
    if (_currentCategoryText) {
        for (let index = 0; index < _categories.length; index++) {
            console.log("found last category, starting from there", _currentCategoryText);
            const _categoryUrl = _categories[index];
            if (_categoryUrl.id == _currentCategoryText) {
                _startIndex = index + 1;
                break;
            }
        }
    }

    for (let index = _startIndex; index < _categories.length; index++) {
        const _categoryUrl = _categories[index];
        console.log("fetching proucts of category - ", _categoryUrl);
        productsRequestedForAdd = await pingoDoce.getNewProducts(_categoryUrl);
        console.log("found ", productsRequestedForAdd.length);
        if (productsRequestedForAdd) {
            var jsonDataObj = {
                StoreId: 3,
                OnlineProductIds: productsRequestedForAdd,
            };
            var response = await fetch('https://lisie.app/api/products/GetOnlineProductIdsNotFound', {
                method: 'POST',
                body: JSON.stringify(jsonDataObj),
                headers: { 'Content-Type': 'application/json' }
            });
            var _json = await response.json();
            console.log("Adding products - ", _json.length);
            console.log(_json);

            productsRequestedForAdd = await pingoDoce.addNewProducts(_json);
        }
        var _setCurrentCategory = await fetch('https://lisie.app/api/online/SetStoreGetterLastCategory?storeId=3&lastCategory=' + _categoryUrl.id);
    }
}
async function intermarcheGetNewProducts() {
    console.log("fetching all Intermarché categories");
    var _categories = await intermarche.getAllCategories();
    console.log("fetching last category, to continue where we were");
    var _currentCategory = await fetch('https://lisie.app/api/online/GetStoreGetterLastCategory?storeId=4');
    // var _currentCategory = await fetch('http://localhost:4430/api/online/GetStoreGetterLastCategory?storeId=2');
    var _currentCategoryText = await _currentCategory.text();
    var productsRequestedForAdd = null;

    //get current category index
    var _startIndex = 0;
    if (_currentCategoryText) {
        for (let index = 0; index < _categories.length; index++) {
            const _categoryUrl = _categories[index];
            if (_categoryUrl == _currentCategoryText) {
                console.log("found last category, starting from there", _currentCategoryText);
                _startIndex = index + 1;
                break;
            }
        }
    }

    for (let index = _startIndex; index < _categories.length; index++) {
        const _categoryUrl = _categories[index];
        console.log("fetching proucts of category - ", _categoryUrl);
        productsRequestedForAdd = await intermarche.getNewProducts(_categoryUrl);
        console.log("found ", productsRequestedForAdd.length);
        if (productsRequestedForAdd) {
            var jsonDataObj = {
                StoreId: 4,
                OnlineProductIds: productsRequestedForAdd,
            };
            // var response = await fetch('http://localhost:4430/api/products/GetOnlineProductIdsNotFound', {
            var response = await fetch('https://lisie.app/api/products/GetOnlineProductIdsNotFound', {
                method: 'POST',
                body: JSON.stringify(jsonDataObj),
                headers: { 'Content-Type': 'application/json' }
            });
            var _json = await response.json();
            // console.log(_json.length);            
            console.log("Adding products - ", _json.length);
            console.log(_json);


            productsRequestedForAdd = await intermarche.addNewProducts(_json);
        }
        console.log("finished Intermarché category, saving last category to server");
        // var _setCurrentCategory = await fetch('http://localhost:4430/api/online/SetStoreGetterLastCategory?storeId=2&lastCategory=' + _categoryUrl);
        var _setCurrentCategory = await fetch('https://lisie.app/api/online/SetStoreGetterLastCategory?storeId=4&lastCategory=' + _categoryUrl);
    }
}

(async () => {
    await goGetter();
})()