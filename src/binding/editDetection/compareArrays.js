
(function () {
    // Simple calculation based on Levenshtein distance.
    function findEditScript(oldArray, newArray) {
        var myMin = Math.min,
            myMax = Math.max,
            editDistanceMatrix = [],
            oldIndex, oldIndexMax = oldArray.length,
            newIndex, newIndexMax = newArray.length,
            maxEditDistance = myMax(1, newIndexMax - oldIndexMax, oldIndexMax - newIndexMax),
            maxDistance = oldIndexMax + newIndexMax + 1,
            thisRow, lastRow;
    
        // Left row - transform old array into empty array via deletions 
        for (oldIndex = 0; oldIndex <= oldIndexMax; oldIndex++)
            editDistanceMatrix[oldIndex] = [oldIndex + 1];
    
        // Fill out the body of the array
        //var countComparisons = 0;
        for (oldIndex = 0; lastRow = thisRow, thisRow = editDistanceMatrix[oldIndex]; oldIndex++) {
            var newIndexMaxForRow = myMin(newIndexMax, oldIndex + maxEditDistance);
            var newIndexMinForRow = myMax(1, oldIndex - maxEditDistance);
            for (newIndex = newIndexMinForRow; newIndex <= newIndexMaxForRow; newIndex++) {
                //++countComparisons;
                if (!oldIndex)  // Top row - transform empty array into new array via additions
                    thisRow[newIndex] = newIndex + 1;
                else if (oldArray[oldIndex - 1] === newArray[newIndex - 1])
                    thisRow[newIndex] = lastRow[newIndex - 1];                  // copy value (no edit)
                else {
                    var northDistance = lastRow[newIndex] || maxDistance;       // deletion
                    var westDistance = thisRow[newIndex - 1] || maxDistance;    // insertion
                    thisRow[newIndex] = myMin(northDistance, westDistance) + 1;
                }
            }
        }
        //console.log('matrix('+maxEditDistance+'): countComparisons=' + countComparisons);

        var editScript = [], added = [], deleted = [], addedOrDeleted;
        for (oldIndex = oldIndexMax, newIndex = newIndexMax; oldIndex || newIndex;) {
            var meMinusOne = editDistanceMatrix[oldIndex][newIndex] - 1, status, value, scriptItem, moveList, index;
            if (meMinusOne === (oldIndex && editDistanceMatrix[oldIndex - 1][newIndex] || maxDistance)) {
                value = oldArray[index = --oldIndex];
                status = "deleted";
                moveList = deleted;
            } else {
                value = newArray[index = --newIndex];
                if (meMinusOne === (editDistanceMatrix[oldIndex][newIndex] || maxDistance)) {
                    status = "added";
                    moveList = added;
                } else {
                    status = "retained";
                    moveList = undefined;
                    --oldIndex;
                }
            }
            editScript.push(scriptItem = { 'status': status, 'value': value });
            if (moveList)
                addedOrDeleted = moveList.push({scriptItem: scriptItem, itemIndex: index, val: value});
        }
        if (addedOrDeleted) {
            // Go through the items that have been added and deleted and try to find matches between them.
            var a, d, addedItem, deletedItem;
            //var countComparisons = 0, countMoves = 0;
            for (a = 0; addedItem = added[a]; a++) {
                for (d = 0; deletedItem = deleted[d]; d++) {
                    //++countComparisons;
                    if (addedItem.val === deletedItem.val) {
                        //++countMoves;
                        addedItem.scriptItem['moveFrom'] = deletedItem.itemIndex;
                        deletedItem.scriptItem['moveTo'] = addedItem.itemIndex;
                        deleted.splice(d,1);        // This item is marked as moved; so remove it from deleted list
                        break;
                    }
                }
            }
            //console.log('move: countComparisons=' + countComparisons + '; countMoves=' + countMoves);
        }
        return editScript.reverse();
    }

    function compareArrays(oldArray, newArray) {
        oldArray = oldArray || [];
        newArray = newArray || [];
        return findEditScript(oldArray, newArray);
    };
    ko.utils.compareArrays = compareArrays; 
})();

ko.exportSymbol('utils.compareArrays', ko.utils.compareArrays);
