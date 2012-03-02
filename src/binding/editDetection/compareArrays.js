
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
    
        // Left row - transform empty array into new array via additions 
        for (oldIndex = 0; oldIndex <= oldIndexMax; oldIndex++)
            editDistanceMatrix[oldIndex] = [oldIndex + 1];
    
        // Fill out the body of the array
        //var countComparisons = 0;
        for (oldIndex = 0; lastRow = thisRow, thisRow = editDistanceMatrix[oldIndex]; oldIndex++) {
            var newIndexMaxForRow = myMin(newIndexMax, oldIndex + maxEditDistance);
            var newIndexMinForRow = myMax(1, oldIndex - maxEditDistance);
            for (newIndex = newIndexMinForRow; newIndex <= newIndexMaxForRow; newIndex++) {
                //++countComparisons;
                if (!oldIndex)  // Top row - transform old array into empty array via deletions
                    thisRow[newIndex] = newIndex + 1;
                else if (oldArray[oldIndex - 1] === newArray[newIndex - 1])
                    thisRow[newIndex] = lastRow[newIndex - 1];                  // copy value (no edit)
                else {
                    var northDistance = thisRow[newIndex - 1] || maxDistance;   // insertion
                    var westDistance = lastRow[newIndex] || maxDistance;        // deletion
                    thisRow[newIndex] = myMin(northDistance, westDistance) + 1;
                }
            }
        }
        //console.log('matrix('+maxEditDistance+'): countComparisons=' + countComparisons);

        var editScript = [], scriptIndex = 0, added = [], deleted = [];
        for (oldIndex = oldIndexMax, newIndex = newIndexMax; oldIndex || newIndex;) {
            var meMinusOne = editDistanceMatrix[oldIndex][newIndex] - 1;
            var distanceViaAdd = newIndex && editDistanceMatrix[oldIndex][newIndex - 1] || maxDistance;
            var distanceViaDelete = oldIndex && editDistanceMatrix[oldIndex - 1][newIndex] || maxDistance;
            var distanceViaRetain = newIndex && oldIndex ? editDistanceMatrix[oldIndex - 1][newIndex - 1] : maxDistance;
            if (distanceViaAdd < meMinusOne) distanceViaAdd = maxDistance;
            if (distanceViaDelete < meMinusOne) distanceViaDelete = maxDistance;
            if (distanceViaRetain < meMinusOne) distanceViaRetain = maxDistance;

            var status, value;
            if ((distanceViaAdd <= distanceViaDelete) && (distanceViaAdd < distanceViaRetain)) {
                value = newArray[--newIndex];
                status = "added";
                added.push({scriptIndex: scriptIndex, newIndex: newIndex, val: value});
            } else {
                value = oldArray[--oldIndex];
                if ((distanceViaDelete < distanceViaAdd) && (distanceViaDelete < distanceViaRetain)) {
                    status = "deleted";
                    deleted.push({scriptIndex: scriptIndex, oldIndex: oldIndex, val: value});
                } else {
                    status = "retained";
                    newIndex--;
                }
            }
            scriptIndex = editScript.push({ 'status': status, 'value': value });
        }
        if (deleted.length && added.length) {
            // Go through the items that have been added and deleted and try to find matches between them.
            var a, d, addedItem, deletedItem;
            //var countComparisons = 0, countMoves = 0;
            for (a = 0; addedItem = added[a]; a++) {
                for (d = 0; deletedItem = deleted[d]; d++) {
                    //++countComparisons;
                    if (addedItem.val === deletedItem.val) {
                        //++countMoves;
                        editScript[addedItem.scriptIndex]['moveFrom'] = deletedItem.oldIndex;
                        editScript[deletedItem.scriptIndex]['moveTo'] = addedItem.newIndex;
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
