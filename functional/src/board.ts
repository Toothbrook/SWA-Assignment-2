export type Generator<T> = { next: () => T };

export type Position = {
    row: number;
    col: number;
};

export type Match<T> = {
    matched: T;
    positions: Position[];
};

export enum DIRECTION {
    UP = "Up",
    DOWN = "Down",
    LEFT = "Left",
    RIGHT = "Right"
}

export type TilePiece<T> = {
    position: Position;
    value: T;
};

export type RemoveMatches<T> = (
    rowMatches: TilePiece<T>[],
    columnMatches: TilePiece<T>[]
) => void;

// ! Q3 (object and array, primitive)
export type Board<T> = {
    width: number;
    height: number;
    tilePieces: TilePiece<T>[];
};

export type MatchResult<T> = {
    boardEffects: BoardEffect<T>[];
    matches: TilePiece<T>[];
};

export type MoveResult<T> = {
    board: Board<T>;
    boardEffects: BoardEffect<T>[];
};

export type BoardEffect<T> = {
    kind: string;
    board?: Board<T>;
    match?: Match<T>;
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
        tilePieces: Init(generator, height, width),
    };
}

export function tilePiece<T>(board: Board<T>, p: Position): T | undefined {
    if (!IsPositionOutsideBoard(board, p)) {
        return undefined;
    }
    return FindTilePieceOnPosition(board, p).value;
}

export function canMove<T>(
    board: Board<T>,
    originalPosition: Position,
    newPosition: Position
): boolean {
    return IsMoveLegal(board, originalPosition, newPosition);
}

export function move<T>(
    generator: Generator<T>,
    board: Board<T>,
    originalPosition: Position,
    newPosition: Position
): MoveResult<T> {
    if (IsMoveLegal(board, originalPosition, newPosition)) {
        SwapPieces(board, originalPosition, newPosition);
        const boardEffects = [];
        CheckBoard(board, generator, boardEffects, MatchValuesRemoved);

        return {
            board,
            boardEffects,
        };
    }

    return {
        board,
        boardEffects: [],
    };
}

function UpdateBoard<T>(
    board: Board<T>,
    generator: Generator<T>,
    effects: BoardEffect<T>[]
) {
    for (let row = 0; row < board.height; row++) {
        for (let col = 0; col < board.width; col++) {
            const foundElement = FindTilePieceOnPosition(board, { row, col });
            if (foundElement.value === undefined) {
                ShiftElementsInColumn(
                    board,
                    foundElement.position.row,
                    foundElement.position.col
                );
                FindTilePieceOnPosition(board, {
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

    CheckBoard(board, generator, effects, MatchValuesRemoved);
}

function FindAllColumnMatches<T>(board: Board<T>): MatchResult<T> {
    let matches: TilePiece<T>[] = [];
    let boardEffects: BoardEffect<T>[] = [];
    for (let i = board.width; i >= 0; i--) {
        const checkedValues: T[] = [];
        const elementsInColumn = FindAllTilePiecesInColumn(board, i);
        for (const element of elementsInColumn) {
            if (!checkedValues.includes(element.value)) {
                checkedValues.push(element.value);
                const result = AllNeighboursInColCheck(board, element);
                matches = matches.concat(result.matches);
                boardEffects = boardEffects.concat(result.boardEffects);
            }
        }
    }
    return {
        matches,
        boardEffects,
    };
}

function FindAllTilePiecesInColumn<T>(board: Board<T>, columnIndex: number) {
    return board.tilePieces.filter((element) => {
        return element.position.col === columnIndex;
    });
}

function ShiftElementsInColumn<T>(
    board: Board<T>,
    fromRow: number,
    col: number
): void {
    for (let row = fromRow; row > 0; row--) {
        SwapPieces(board, { row, col }, { row: row - 1, col });
    }
}

function FindNextPiecePosition<T>(
    currentPiece: TilePiece<T>,
    direction: DIRECTION
) {
    let position: Position = {
        row: currentPiece.position.row,
        col: currentPiece.position.col,
    };
    if (direction === DIRECTION.DOWN) {
        position.row += 1;
    }

    if (direction === DIRECTION.UP) {
        position.row -= 1;
    }

    if (direction === DIRECTION.LEFT) {
        position.col -= 1;
    }

    if (direction === DIRECTION.RIGHT) {
        position.col += 1;
    }
    return position;
}

function AllNeighboursInColCheck<T>(
    board: Board<T>,
    startPiece: TilePiece<T>
): MatchResult<T> {
    const nextTopPosition = FindNextPiecePosition(
        startPiece,
        DIRECTION.UP
    );
    const pieceOnNextTopPosition = FindTilePieceOnPosition(board, nextTopPosition);
    const topElements = CheckNeighbours(
        board,
        pieceOnNextTopPosition,
        [],
        startPiece.value,
        DIRECTION.UP
    );
    const downElements = CheckNeighbours(
        board,
        FindTilePieceOnPosition(
            board,
            FindNextPiecePosition(startPiece, DIRECTION.DOWN)
        ),
        [],
        startPiece.value,
        DIRECTION.DOWN
    );

    if (topElements.length + downElements.length + 1 >= 3) {
        const matchedPieces = [...topElements, startPiece, ...downElements];
        return CreateBoardEffectForMatch(matchedPieces);
    }

    return {
        boardEffects: [],
        matches: [],
    };
}

function CheckNeighbours<T>(
    board: Board<T>,
    currentPiece: TilePiece<T>,
    matchingPieces: TilePiece<T>[],
    value: T,
    Direction: DIRECTION
) {
    if (!currentPiece) {
        return matchingPieces;
    }
    if (currentPiece.value === value) {
        matchingPieces.push(currentPiece);
        const nextPiece = FindTilePieceOnPosition(
            board,
            FindNextPiecePosition(currentPiece, Direction)
        );
        CheckNeighbours(board, nextPiece, matchingPieces, value, Direction);
    }
    return matchingPieces;
}

function IsMoveLegal<T>(
    board: Board<T>,
    originalPosition: Position,
    newPosition: Position
): boolean {
    if (
        !IsPositionOutsideBoard(board, originalPosition) ||
        !IsPositionOutsideBoard(board, newPosition)
    ) {
        return false;
    }
    if (
        originalPosition.col === newPosition.col &&
        originalPosition.row === newPosition.row
    ) {
        return false;
    }

    if (
        originalPosition.col !== newPosition.col &&
        originalPosition.row !== newPosition.row
    ) {
        return false;
    }

    SwapPieces(board, originalPosition, newPosition);
    const matchesInRows = FindAllRowMatches(board);
    const matchesInColumns = FindAllColumnMatches(board);
    SwapPieces(board, originalPosition, newPosition);

    if (!matchesInRows.matches.length && !matchesInColumns.matches.length) {
        return false;
    }
    return true;
}

function CheckBoard<T>(
    board: Board<T>,
    generator: Generator<T>,
    effects: BoardEffect<T>[],
    removeMatchesFn: RemoveMatches<T>
): void {
    const rowMatchResults = FindAllRowMatches(board);
    const columnMatchResults = FindAllColumnMatches(board);
    effects.push(...rowMatchResults.boardEffects);
    effects.push(...columnMatchResults.boardEffects);
    if (rowMatchResults.matches.length || columnMatchResults.matches.length) {
        removeMatchesFn(rowMatchResults.matches, columnMatchResults.matches);
        UpdateBoard(board, generator, effects);
    }
}

function FindAllRowMatches<T>(board: Board<T>): MatchResult<T> {
    let matches: TilePiece<T>[] = [];
    let boardEffects: BoardEffect<T>[] = [];
    for (let i = 0; i < board.height; i++) {
        const checkedValues: T[] = [];
        const elementsInRow = FindAllTilePiecesInRow(board, i);
        for (const element of elementsInRow) {
            if (!checkedValues.includes(element.value)) {
                checkedValues.push(element.value);
                const result = AllNeighboursInRowCheck(board, element);
                matches = matches.concat(result.matches);
                boardEffects = boardEffects.concat(result.boardEffects);
            }
        }
    }
    return {
        matches,
        boardEffects,
    };
}

function AllNeighboursInRowCheck<T>(
    board: Board<T>,
    startPiece: TilePiece<T>
): MatchResult<T> {
    const leftSideElements = CheckNeighbours(
        board,
        FindTilePieceOnPosition(
            board,
            FindNextPiecePosition(startPiece, DIRECTION.LEFT)
        ),
        [],
        startPiece.value,
        DIRECTION.LEFT
    );
    const rightSideElements = CheckNeighbours(
        board,
        FindTilePieceOnPosition(
            board,
            FindNextPiecePosition(startPiece, DIRECTION.RIGHT)
        ),
        [],
        startPiece.value,
        DIRECTION.RIGHT
    );

    if (leftSideElements.length + rightSideElements.length + 1 >= 3) {
        const matchedPieces = [
            ...leftSideElements,
            startPiece,
            ...rightSideElements,
        ];
        return CreateBoardEffectForMatch(matchedPieces);
    }

    return {
        boardEffects: [],
        matches: [],
    };
}

function FindAllTilePiecesInRow<T>(board: Board<T>, rowIndex: number) {
    return board.tilePieces.filter((element) => {
        return element.position.row === rowIndex;
    });
}


function CreateBoardEffectForMatch<T>(matchedPieces: TilePiece<T>[]) {
    return {
        boardEffects: [
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


function MatchValuesRemoved<T>(
    matchesRows: TilePiece<T>[],
    matchesColumn: TilePiece<T>[]
): void {
    matchesRows.forEach((match) => {
        match.value = undefined;
    });
    matchesColumn.forEach((match) => {
        match.value = undefined;
    });
}

function IsPositionOutsideBoard<T>(board: Board<T>, p: Position): boolean {
    if (p.col >= board.width || p.col < 0) {
        return false;
    }

    if (p.row >= board.height || p.row < 0) {
        return false;
    }
    return true;
}

function SwapPieces<T>(board: Board<T>, first: Position, second: Position) {
    const firstPiece = FindTilePieceOnPosition(board, first);
    const secondPiece = FindTilePieceOnPosition(board, second);

    const firstIndex = board.tilePieces.indexOf(firstPiece);
    const secondIndex = board.tilePieces.indexOf(secondPiece);

    (board.tilePieces as any).swapProperties(firstIndex, secondIndex, `value`);
}

function FindTilePieceOnPosition<T>(board: Board<T>, position: Position) {

    return board.tilePieces.find((element: TilePiece<T>) => {
        return (
            element.position.col == position.col &&
            element.position.row == position.row
        );
    });
}

function Init<T>(
    generator: Generator<T>,
    height: number,
    width: number
): TilePiece<T>[] {
    const pieces: TilePiece<T>[] = [];
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
