
export type Generator<T> = { next: () => T }

export type Position =
    {
        row: number,
        col: number
    }

export type Match<T> =
    {
        matched: T,
        positions: Position[]
    }

export enum DIRECTION {
    UP = "Up",
    DOWN = "Down",
    LEFT = "Left",
    RIGHT = "Right"
}

export type BoardEvent<T> =
    {
        kind: 'Match' | 'Refill';
        match?: Match<T>;
    }

export type TilePiece<T> =
    {
        position: Position;
        value: T;
    }

export type BoardListener<T> = (event: BoardEvent<T>) => void;

export class Board<T>
{
    height: number;
    width: number;

    boardGenerator: Generator<T>;
    tilePieces: TilePiece<T>[] = [];
    boardListeners: BoardListener<T>[] = [];
    isEventsEnabled: boolean = false;

    constructor(boardGenerator: Generator<T>, boardColumns: number, boardRows: number) {
        this.height = boardRows;
        this.width = boardColumns;
        this.boardGenerator = boardGenerator;
        this.CreateBoard();
    }

    public addListener(boardListener: BoardListener<T>) {
        this.boardListeners.push(boardListener);
    }

    public piece(tilePiece: Position): T | undefined {
        if (!this.IsPositionWithinBoard(tilePiece)) {
            return undefined;
        }
        return this.FindTilePieceAtPosition(tilePiece).value;
    }

    private CreateBoard(): void {
        for (let row = 0; row < this.height; row++) {
            for (let col = 0; col < this.width; col++) {
                this.tilePieces.push({ value: this.boardGenerator.next(), position: { row, col } });
            }
        }

        (this.tilePieces as any).swapProperties = (originalIndex: number, newIndex: number, property: string) => {
            const originalTilePieceValue = this.tilePieces[originalIndex][property];
            const newTilePieceValue = this.tilePieces[newIndex][property];
            this.tilePieces[originalIndex][property] = newTilePieceValue;
            this.tilePieces[newIndex][property] = originalTilePieceValue;
        }
    }

    public canMove(originalPosition: Position, newPosition: Position): boolean {
        return this.IsMoveLegal(originalPosition, newPosition);
    }

    public move(originalPosition: Position, newPosition: Position) {
        if (this.IsMoveLegal(originalPosition, newPosition)) {
            this.isEventsEnabled = true;
            this.SwapTilePieces(originalPosition, newPosition);
            this.CheckBoard();
            this.isEventsEnabled = false;
        }
        return null;
    }

    private IsMoveLegal(originalPosition: Position, newPosition: Position): boolean {
        if (this.IsSameTile(originalPosition, newPosition)) {
            return false;
        }
        else if (!this.IsTileSameRowOrColumn(originalPosition, newPosition)) {
            return false;
        }
        else if (!this.IsPositionWithinBoard(originalPosition) || !this.IsPositionWithinBoard(newPosition)) {
            return false;
        }

        return this.MoveResultInMatches(originalPosition, newPosition);

    }

    private UpdateBoard(): void {
        this.boardListeners.forEach((boardListener) => {
            boardListener({ kind: 'Refill' })
        });

        for (let row = 0; row < this.height; row++) {
            for (let col = 0; col < this.width; col++) {
                const currentTilePiece = this.FindTilePieceAtPosition({ row, col });
                if (currentTilePiece.value === undefined) {
                    this.shiftElementsInColumn(currentTilePiece.position.row, currentTilePiece.position.col);
                    this.FindTilePieceAtPosition({ row: 0, col: currentTilePiece.position.col }).value = this.boardGenerator.next();
                }
            }
        }
        this.CheckBoard();
    }

    private CheckBoard() {
        const rowMatches = this.FindRowMatches();
        const colMatches = this.FindColMatches();
        if (rowMatches.length || colMatches.length) {
            this.DestroyMatchedTilePieces(rowMatches, colMatches);
            this.UpdateBoard()
        }
    }

    private shiftElementsInColumn(originalRow: number, col: number): void {
        for (let row = originalRow; row > 0; row--) {
            this.SwapTilePieces({ row, col }, { row: row - 1, col });
        }
    }

    private DestroyMatchedTilePieces(rowMatches: TilePiece<T>[], colMatches: TilePiece<T>[]): void {
        rowMatches.forEach((match) => {
            match.value = undefined;
        });

        colMatches.forEach((match) => {
            match.value = undefined;
        });
    }

    private MoveResultInMatches(originalPosition: Position, newPosition: Position): boolean {
        this.SwapTilePieces(originalPosition, newPosition);
        const isMatches = this.IsAnyMatch();
        this.SwapTilePieces(newPosition, originalPosition);
        return isMatches;
    }

    private IsAnyMatch(): boolean {
        const rowMatchesList = this.FindRowMatches();
        const colMatchesList = this.FindColMatches();

        if (!rowMatchesList.length && !colMatchesList.length) {
            return false;
        }
        return true;
    }

    private FindRowMatches() {
        let rowMatches: TilePiece<T>[] = [];
        for (let i = 0; i < this.height; i++) {
            const tilePiecesInRow = this.FindPiecesInRow(i);
            for (const tilePiece of tilePiecesInRow) {
                if (!rowMatches.includes(tilePiece)) {
                    rowMatches = rowMatches.concat(this.AllNeighboursInRowCheck(tilePiece))
                }
            }
        }
        return rowMatches;
    }

    private AllNeighboursInRowCheck(originalTilePiece: TilePiece<T>) {
        const tilePiecesToTheLeft = this.NeighbourOfTilePieceCheck(this.FindTilePieceAtPosition(this.FindPositionOfNextTilePiece(originalTilePiece, DIRECTION.LEFT)), [], originalTilePiece.value, DIRECTION.LEFT);
        const tilePiecesToTheRight = this.NeighbourOfTilePieceCheck(this.FindTilePieceAtPosition(this.FindPositionOfNextTilePiece(originalTilePiece, DIRECTION.RIGHT)), [], originalTilePiece.value, DIRECTION.RIGHT);
        if (tilePiecesToTheLeft.length + tilePiecesToTheRight.length + 1 >= 3) {
            const tilePiecesInMatch = [
                ...tilePiecesToTheLeft,
                originalTilePiece,
                ...tilePiecesToTheRight,
            ];

            if (this.isEventsEnabled) {
                this.CallAllListenersOnMatch(tilePiecesInMatch);
            }
            return tilePiecesInMatch;
        }

        return [];
    }

    private CallAllListenersOnMatch(tilePiecesInMatch: TilePiece<T>[]) {
        this.boardListeners.forEach((boardListener) => {
            boardListener({ kind: 'Match', match: { matched: { ...tilePiecesInMatch[0] }.value, positions: tilePiecesInMatch.map((match) => match.position) } });
        });
    }

    private NeighbourOfTilePieceCheck(originalTilePiece: TilePiece<T>, TilePiecesMatched: TilePiece<T>[], value: T, directionToCheck: DIRECTION): TilePiece<T>[] {
        if (!originalTilePiece) {
            return TilePiecesMatched;
        }
        if (originalTilePiece.value === value) {
            TilePiecesMatched.push(originalTilePiece);
            const neighbourTilePiece = this.FindTilePieceAtPosition(this.FindPositionOfNextTilePiece(originalTilePiece, directionToCheck));
            this.NeighbourOfTilePieceCheck(neighbourTilePiece, TilePiecesMatched, value, directionToCheck);
        }
        return TilePiecesMatched;
    }

    private FindPositionOfNextTilePiece(originalTilePiece: TilePiece<T>, directionToCheck: DIRECTION): Position {
        let positionOfNextTilePiece: Position =
        {
            row: originalTilePiece.position.row,
            col: originalTilePiece.position.col,
        };
        switch (directionToCheck) {
            case DIRECTION.UP:
                positionOfNextTilePiece.row -= 1;
                break;

            case DIRECTION.DOWN:
                positionOfNextTilePiece.row += 1;
                break;

            case DIRECTION.LEFT:
                positionOfNextTilePiece.col -= 1;
                break;

            case DIRECTION.RIGHT:
                positionOfNextTilePiece.col += 1;

        }
        return positionOfNextTilePiece;
    }

    private FindPiecesInRow(index: number): TilePiece<T>[] {
        return this.tilePieces.filter((e) => {
            return e.position.row === index;
        })
    }

    private AllNeighboursInColCheck(originalTilePiece: TilePiece<T>) {
        const positionOfTilePieceAbove = this.FindPositionOfNextTilePiece(originalTilePiece, DIRECTION.UP);
        const tilePieceAbove = this.FindTilePieceAtPosition(positionOfTilePieceAbove);
        const tilePiecesAbove = this.NeighbourOfTilePieceCheck(tilePieceAbove, [], originalTilePiece.value, DIRECTION.UP);
        const tilePiecesBelow = this.NeighbourOfTilePieceCheck(this.FindTilePieceAtPosition(this.FindPositionOfNextTilePiece(originalTilePiece, DIRECTION.DOWN)), [], originalTilePiece.value, DIRECTION.DOWN);

        if (tilePiecesAbove.length + tilePiecesBelow.length + 1 >= 3) {
            const tilePiecesInMatch = [
                ...tilePiecesAbove,
                originalTilePiece,
                ...tilePiecesBelow,
            ];

            if (this.isEventsEnabled) {
                this.CallAllListenersOnMatch(tilePiecesInMatch);
            }
            return tilePiecesInMatch;
        }

        return [];
    }

    private FindColMatches() {
        let colMatches: TilePiece<T>[] = [];
        for (let i = this.width; i >= 0; i--) {
            const tilePiecesInCol = this.FindPiecesInCol(i);
            for (const tilePiece of tilePiecesInCol) {
                if (!colMatches.includes(tilePiece)) {
                    colMatches = colMatches.concat(this.AllNeighboursInColCheck(tilePiece))
                }
            }
        }
        return colMatches;
    }

    private FindPiecesInCol(index: number): TilePiece<T>[] {
        return this.tilePieces.filter((e) => {
            return e.position.col === index;
        })
    }

    private SwapTilePieces(originalPosition: Position, newPosition: Position) {
        const originalTilePiece = this.FindTilePieceAtPosition(originalPosition)
        const newTilePiece = this.FindTilePieceAtPosition(newPosition)
        const originalIndex = this.tilePieces.indexOf(originalTilePiece);
        const newIndex = this.tilePieces.indexOf(newTilePiece);

        (this.tilePieces as any).swapProperties(originalIndex, newIndex, 'value')
    }

    private FindTilePieceAtPosition(positionOfTilePiece: Position): TilePiece<T> {
        return this.tilePieces.find((e) => {
            return (e.position.row == positionOfTilePiece.row && e.position.col == positionOfTilePiece.col);
        }
        );
    }

    private IsSameTile(originalPosition: Position, positionToBeChecked: Position): boolean {
        if (originalPosition.row === positionToBeChecked.row && originalPosition.col === positionToBeChecked.col) {
            return true;
        }
        return false;
    }

    private IsTileSameRowOrColumn(originalPosition: Position, positionToBeChecked: Position): boolean {
        if (originalPosition.row !== positionToBeChecked.row && originalPosition.col !== positionToBeChecked.col) {
            return false;
        }
        return true
    }

    private IsPositionWithinBoard(position: Position): boolean {
        if ((position.row < this.height && position.row >= 0) && (position.col < this.width && position.col >= 0)) {
            return true;
        }
        return false;
    }


}
