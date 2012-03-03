
ko.utils.compareArrays = (function () {
    // Simple calculation based on Levenshtein distance.
    function compareArrays(oldArray, newArray) {
        oldArray = oldArray || [];
        newArray = newArray || [];

        var myMin = Math.min,
            myMax = Math.max,
            editDistanceMatrix = [],
            oldIndex, oldIndexMax = oldArray.length,
            newIndex, newIndexMax = newArray.length,
            maxEditDistance = myMax(1, newIndexMax - oldIndexMax, oldIndexMax - newIndexMax),
            maxDistance = oldIndexMax + newIndexMax + 1,
            thisRow, lastRow,
            newIndexMaxForRow, newIndexMinForRow;
    
        // Left row - transform old array into empty array via deletions 
        for (oldIndex = 0; oldIndex <= oldIndexMax; oldIndex++)
            editDistanceMatrix[oldIndex] = [oldIndex + 1];
    
        // Fill out the body of the array
        //var countComparisons = 0;
        for (oldIndex = 0; lastRow = thisRow, thisRow = editDistanceMatrix[oldIndex]; oldIndex++) {
            newIndexMaxForRow = myMin(newIndexMax, oldIndex + maxEditDistance);
            newIndexMinForRow = myMax(1, oldIndex - maxEditDistance);
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

        var editScript = [], meMinusOne, added = [], deleted = [], addedOrDeleted;
        for (oldIndex = oldIndexMax, newIndex = newIndexMax; oldIndex || newIndex;) {
            meMinusOne = editDistanceMatrix[oldIndex][newIndex] - 1;
            if (newIndex && meMinusOne === editDistanceMatrix[oldIndex][newIndex-1]) {
                addedOrDeleted = added.push(editScript[editScript.length] = {
                    'status': "added",
                    'value': newArray[--newIndex],
                    'to': newIndex });
            } else if (oldIndex && meMinusOne === editDistanceMatrix[oldIndex - 1][newIndex]) {
                addedOrDeleted = deleted.push(editScript[editScript.length] = {
                    'status': "deleted",
                    'value': oldArray[--oldIndex],
                    'from': oldIndex });
            } else {
                editScript.push({
                    'status': "retained",
                    'value': newArray[--newIndex],
                    'from': --oldIndex,
                    'to': newIndex });
            }
        }

        if (addedOrDeleted) {
            // Go through the items that have been added and deleted and try to find matches between them.
            var a, d, addedItem, deletedItem;
            //var countComparisons = 0, countMoves = 0;
            for (a = 0; addedItem = added[a]; a++) {
                for (d = 0; deletedItem = deleted[d]; d++) {
                    //++countComparisons;
                    if (addedItem['value'] === deletedItem['value']) {
                        //++countMoves;
                        addedItem['moveFrom'] = deletedItem['from'];
                        deletedItem['moveTo'] = addedItem['to'];
                        deleted.splice(d,1);        // This item is marked as moved; so remove it from deleted list
                        break;
                    }
                }
            }
            //console.log('move: countComparisons=' + countComparisons + '; countMoves=' + countMoves);
        }
        return editScript.reverse();
    }

    return compareArrays; 
})();

ko.exportSymbol('utils.compareArrays', ko.utils.compareArrays);
