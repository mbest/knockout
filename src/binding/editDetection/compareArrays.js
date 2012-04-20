
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
            maxEditDistance = Math.abs(newIndexMax - oldIndexMax) || 1,
            maxDistance = oldIndexMax + newIndexMax + 1,
            thisRow, lastRow,
            newIndexMaxForRow, newIndexMinForRow;

        for (oldIndex = 0; oldIndex <= oldIndexMax; oldIndex++)
            editDistanceMatrix.push([]);

        // Left row - transform old array into empty array via deletions
        for (oldIndex = 0, newIndexMaxForRow = myMin(oldIndexMax, maxEditDistance); oldIndex <= newIndexMaxForRow; oldIndex++)
            editDistanceMatrix[oldIndex][0] = oldIndex + 1;

        // Fill out the body of the array
        for (oldIndex = 0; lastRow = thisRow, thisRow = editDistanceMatrix[oldIndex]; oldIndex++) {
            newIndexMaxForRow = myMin(newIndexMax, oldIndex + maxEditDistance);
            newIndexMinForRow = myMax(1, oldIndex - maxEditDistance);
            for (newIndex = newIndexMinForRow; newIndex <= newIndexMaxForRow; newIndex++) {
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

        var editScript = [], meMinusOne, added = [], deleted = [];
        for (oldIndex = oldIndexMax, newIndex = newIndexMax; oldIndex || newIndex;) {
            meMinusOne = editDistanceMatrix[oldIndex][newIndex] - 1;
            if (newIndex && meMinusOne === editDistanceMatrix[oldIndex][newIndex-1]) {
                added.push(editScript[editScript.length] = {
                    'status': "added",
                    'value': newArray[--newIndex],
                    'to': newIndex });
            } else if (oldIndex && meMinusOne === editDistanceMatrix[oldIndex - 1][newIndex]) {
                deleted.push(editScript[editScript.length] = {
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

        if (added.length && deleted.length) {
            // Go through the items that have been added and deleted and try to find matches between them.
            var a, d, addedItem, deletedItem;
            for (a = 0; addedItem = added[a]; a++) {
                for (d = 0; deletedItem = deleted[d]; d++) {
                    if (addedItem['value'] === deletedItem['value']) {
                        addedItem['moveFrom'] = deletedItem['from'];
                        deletedItem['moveTo'] = addedItem['to'];
                        deleted.splice(d,1);        // This item is marked as moved; so remove it from deleted list
                        break;
                    }
                }
            }
        }
        return editScript.reverse();
    }

    return compareArrays;
})();

ko.exportSymbol('utils.compareArrays', ko.utils.compareArrays);
