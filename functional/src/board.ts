export type Generator<T> = { next: () => T };

export type Position = {
    row: number;
    col: number;
};

export enum CHECK_DIRECTION {
    LEFT = `Left`,
    RIGHT = `Right`,
    TOP = `Top`,
    DOWN = `Down`,
}

export type Match<T> = {
    matched: T;
    positions: Position[];
};

export type Piece<T> = {
    value: T;
    position: Position;
};

export type Board<T> = {
    width: number;
    height: number;
    pieces: Piece<T>[];
};

export type Effect<T> = {
    kind: string;
    board?: Board<T>;
    match?: Match<T>;
};

export type MatchResult<T> = {
    effects: Effect<T>[];
    matches: Piece<T>[];
};

export type MoveResult<T> = {
    board: Board<T>;
    effects: Effect<T>[];
};

/* ----------------------------- GIVEN FUNCTIONS ---------------------------- */

export function create<T>(
    generator: Generator<T>,
    width: number,
    height: number
): Board<T> {
    return {
        width,
        height,
        pieces: initBoardFill(generator, height, width),
    };
}

export function piece<T>(board: Board<T>, p: Position): T | undefined {
    if (!isPositionOutsideBoard(board, p)) {
        return undefined;
    }
    return findPieceOnPosition(board, p).value;
}

export function canMove<T>(
    board: Board<T>,
    first: Position,
    second: Position
): boolean {
    return isMoveLegal(board, first, second);
}

export function move<T>(
    generator: Generator<T>,
    board: Board<T>,
    first: Position,
    second: Position
): MoveResult<T> {
    if (isMoveLegal(board, first, second)) {
        swapPieces(board, first, second);
        const effects = [];
        scanBoard(board, generator, effects);

        return {
            board,
            effects,
        };
    }

    return {
        board,
        effects: [],
    };
}

/* -------------------------------------------------------------------------- */
/*                          MOVING AND REFILING PART                          */
/* -------------------------------------------------------------------------- */

/* ----------------------- COLUMN MATCHES WITH RECURSTION ---------------------- */

/**
 * Searchs for matches in all rows of the board.
 * @param board the given board
 * @returns matches with all occured effects
 */
function getAllColumnMatches<T>(board: Board<T>): MatchResult<T> {
    let matches: Piece<T>[] = [];
    let effects: Effect<T>[] = [];
    for (let i = board.width; i >= 0; i--) {
        const checkedValues: T[] = [];
        const elementsInColumn = getAllPiecesInColumn(board, i);
        for (const element of elementsInColumn) {
            if (!checkedValues.includes(element.value)) {
                checkedValues.push(element.value);
                const result = columnDeepNeighbourCheck(board, element);
                matches = matches.concat(result.matches);
                effects = effects.concat(result.effects);
            }
        }
    }
    return {
        matches,
        effects,
    };
}
/**
 * Searches for matches on the top and bottom of the given element. And fires event when enabled.
 * @param board
 * @param startPiece the given start element
 * @returns matches with effects
 */
function columnDeepNeighbourCheck<T>(
    board: Board<T>,
    startPiece: Piece<T>
): MatchResult<T> {
    const nextTopPosition = findNextPiecePosition(
        startPiece,
        CHECK_DIRECTION.TOP
    );
    const pieceOnNextTopPosition = findPieceOnPosition(board, nextTopPosition);
    const topElements = neighourCheck(
        board,
        pieceOnNextTopPosition,
        [],
        startPiece.value,
        CHECK_DIRECTION.TOP
    );
    const downElements = neighourCheck(
        board,
        findPieceOnPosition(
            board,
            findNextPiecePosition(startPiece, CHECK_DIRECTION.DOWN)
        ),
        [],
        startPiece.value,
        CHECK_DIRECTION.DOWN
    );

    if (topElements.length + downElements.length + 1 >= 3) {
        const matchedPieces = [...topElements, startPiece, ...downElements];
        return generateMatchEffect(matchedPieces);
    }

    return {
        effects: [],
        matches: [],
    };
}

function refillBoard<T>(
    board: Board<T>,
    generator: Generator<T>,
    effects: Effect<T>[]
) {
    for (let row = 0; row < board.height; row++) {
        for (let col = 0; col < board.width; col++) {
            const foundElement = findPieceOnPosition(board, { row, col });
            if (foundElement.value === undefined) {
                shiftElementsInColumn(
                    board,
                    foundElement.position.row,
                    foundElement.position.col
                );
                findPieceOnPosition(board, {
                    row: 0,
                    col: foundElement.position.col,
                }).value = generator.next();
            }
        }
    }
    effects.push({
        kind: `Refill`,
        board,
    });

    scanBoard(board, generator, effects);
}

function shiftElementsInColumn<T>(
    board: Board<T>,
    fromRow: number,
    col: number
): void {
    for (let row = fromRow; row > 0; row--) {
        swapPieces(board, { row, col }, { row: row - 1, col });
    }
}

/**
 * Return the position of the next element based on the given direction and given piece
 * @param currentPiece the piece to compare with
 * @param direction the direction to find next piece
 * @returns the postion of the found next piece
 */
function findNextPiecePosition<T>(
    currentPiece: Piece<T>,
    direction: CHECK_DIRECTION
) {
    let position: Position = {
        row: currentPiece.position.row,
        col: currentPiece.position.col,
    };
    if (direction === CHECK_DIRECTION.DOWN) {
        position.row += 1;
    }

    if (direction === CHECK_DIRECTION.TOP) {
        position.row -= 1;
    }

    if (direction === CHECK_DIRECTION.LEFT) {
        position.col -= 1;
    }

    if (direction === CHECK_DIRECTION.RIGHT) {
        position.col += 1;
    }
    return position;
}

/* ----------------------- ROW MATCHES WITH RECURSTION ---------------------- */

/**
 * Searchs for matches in all rows of the board.
 * @returns the array with all found matches
 */
function getAllRowMatches<T>(board: Board<T>): MatchResult<T> {
    let matches: Piece<T>[] = [];
    let effects: Effect<T>[] = [];
    for (let i = 0; i < board.height; i++) {
        const checkedValues: T[] = [];
        const elementsInRow = getAllPiecesInRow(board, i);
        for (const element of elementsInRow) {
            if (!checkedValues.includes(element.value)) {
                checkedValues.push(element.value);
                const result = rowDeepNeighbourCheck(board, element);
                matches = matches.concat(result.matches);
                effects = effects.concat(result.effects);
            }
        }
    }
    return {
        matches,
        effects,
    };
}

/**
 * Searches for matches on the left and right of the given element. And fires event when enabled.
 * @param startPiece the given start element
 * @returns the empty array or array with all matched elements
 */
function rowDeepNeighbourCheck<T>(
    board: Board<T>,
    startPiece: Piece<T>
): MatchResult<T> {
    const leftSideElements = neighourCheck(
        board,
        findPieceOnPosition(
            board,
            findNextPiecePosition(startPiece, CHECK_DIRECTION.LEFT)
        ),
        [],
        startPiece.value,
        CHECK_DIRECTION.LEFT
    );
    const rightSideElements = neighourCheck(
        board,
        findPieceOnPosition(
            board,
            findNextPiecePosition(startPiece, CHECK_DIRECTION.RIGHT)
        ),
        [],
        startPiece.value,
        CHECK_DIRECTION.RIGHT
    );

    if (leftSideElements.length + rightSideElements.length + 1 >= 3) {
        const matchedPieces = [
            ...leftSideElements,
            startPiece,
            ...rightSideElements,
        ];
        return generateMatchEffect(matchedPieces);
    }

    return {
        effects: [],
        matches: [],
    };
}

/**
 * A recursive function that goes to the given direction of the given element and compares its value.
 * When values are the same it is added to the given array and the process repeats until invalid value or end of the board reached.
 * @param currentPiece the current checking piece
 * @param matchingPieces the array with all found matches until now
 * @param value the given value to compare with
 * @param checkDirection the checking process direction
 * @returns the array with all found matches
 */
function neighourCheck<T>(
    board: Board<T>,
    currentPiece: Piece<T>,
    matchingPieces: Piece<T>[],
    value: T,
    checkDirection: CHECK_DIRECTION
) {
    if (!currentPiece) {
        return matchingPieces;
    }
    if (currentPiece.value === value) {
        matchingPieces.push(currentPiece);
        const nextPiece = findPieceOnPosition(
            board,
            findNextPiecePosition(currentPiece, checkDirection)
        );
        neighourCheck(board, nextPiece, matchingPieces, value, checkDirection);
    }
    return matchingPieces;
}

/**
 * Searchs for matches in all rows of the board.
 * @returns the array with all found matches
 */
function getAllPiecesInRow<T>(board: Board<T>, rowIndex: number) {
    return board.pieces.filter((element) => {
        return element.position.row === rowIndex;
    });
}

/**
 * Returns all elements for the given column
 * @param columnIndex The column index from which elements will be returned
 * @returns All the elements in the given column
 */
function getAllPiecesInColumn<T>(board: Board<T>, columnIndex: number) {
    return board.pieces.filter((element) => {
        return element.position.col === columnIndex;
    });
}

/* -------------------------------------------------------------------------- */
/*                               HELPERS / UTILS                              */
/* -------------------------------------------------------------------------- */

/**
 * Scans the board to find all matches, removes them and calls a recursive refill function
 */
function scanBoard<T>(
    board: Board<T>,
    generator: Generator<T>,
    effects: Effect<T>[]
): void {
    const rowMatchResults = getAllRowMatches(board);
    const columnMatchResults = getAllColumnMatches(board);
    effects.push(...rowMatchResults.effects);
    effects.push(...columnMatchResults.effects);
    if (rowMatchResults.matches.length || columnMatchResults.matches.length) {
        removedMatchedValues(rowMatchResults.matches, columnMatchResults.matches);
        refillBoard(board, generator, effects);
    }
}

/**
 *
 * @param matchedPieces Generates move effect based on given pieces
 * @returns Generated effect
 */
function generateMatchEffect<T>(matchedPieces: Piece<T>[]) {
    return {
        effects: [
            {
                kind: `Match`,
                match: {
                    matched: { ...matchedPieces[0] }.value,
                    positions: matchedPieces.map((match) => match.position),
                },
            },
        ],
        matches: matchedPieces,
    };
}

/**
 * For each matched pieces sets value as undefined
 * @param matchesRows matched pieces in rows
 * @param matchesColumn matched pieces in columns
 */
function removedMatchedValues<T>(
    matchesRows: Piece<T>[],
    matchesColumn: Piece<T>[]
): void {
    matchesRows.forEach((match) => {
        match.value = undefined;
    });
    matchesColumn.forEach((match) => {
        match.value = undefined;
    });
}

/**
 * Checks if move is legal according to the game rules
 * @param firstPosition the postion of the first element
 * @param secondPosition the position of the second element
 * @returns boolean value based on the move legal state
 */
function isMoveLegal<T>(
    board: Board<T>,
    firstPosition: Position,
    secondPosition: Position
): boolean {
    if (
        !isPositionOutsideBoard(board, firstPosition) ||
        !isPositionOutsideBoard(board, secondPosition)
    ) {
        return false;
    }
    if (
        firstPosition.col === secondPosition.col &&
        firstPosition.row === secondPosition.row
    ) {
        return false;
    }

    if (
        firstPosition.col !== secondPosition.col &&
        firstPosition.row !== secondPosition.row
    ) {
        return false;
    }

    swapPieces(board, firstPosition, secondPosition);
    const matchesInRows = getAllRowMatches(board);
    const matchesInColumns = getAllColumnMatches(board);
    swapPieces(board, firstPosition, secondPosition);

    if (!matchesInRows.matches.length && !matchesInColumns.matches.length) {
        return false;
    }
    return true;
}

/**
 * Checks is the given postion is outside of the generated board
 * @param p the given position
 * @returns boolean value based on the check state
 */
function isPositionOutsideBoard<T>(board: Board<T>, p: Position): boolean {
    if (p.col >= board.width || p.col < 0) {
        return false;
    }

    if (p.row >= board.height || p.row < 0) {
        return false;
    }
    return true;
}

/**
 * Finds elements on given position and swaps their values based on the fuction patched to pieces array
 * @param first position of the first element
 * @param second position of th second element
 */
function swapPieces<T>(board: Board<T>, first: Position, second: Position) {
    const firstPiece = findPieceOnPosition(board, first);
    const secondPiece = findPieceOnPosition(board, second);

    const firstIndex = board.pieces.indexOf(firstPiece);
    const secondIndex = board.pieces.indexOf(secondPiece);

    (board.pieces as any).swapProperties(firstIndex, secondIndex, `value`);
}

function findPieceOnPosition<T>(board: Board<T>, position: Position) {
    return board.pieces.find((element) => {
        return (
            element.position.col == position.col &&
            element.position.row == position.row
        );
    });
}

/**
 * Fills the board with inital values given by the generator
 */
function initBoardFill<T>(
    generator: Generator<T>,
    height: number,
    width: number
): Piece<T>[] {
    const pieces: Piece<T>[] = [];
    for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
            pieces.push({
                value: generator.next(),
                position: {
                    row,
                    col,
                },
            });
        }
    }

    // Monkey patched function to pieces object
    (pieces as any).swapProperties = (
        firstIndex: number,
        secondIndex: number,
        propertyToSwap: string
    ) => {
        const firstPieceValue = pieces[firstIndex][propertyToSwap];
        const secondPieceValue = pieces[secondIndex][propertyToSwap];
        pieces[firstIndex][propertyToSwap] = secondPieceValue;
        pieces[secondIndex][propertyToSwap] = firstPieceValue;
    };

    return pieces;
}