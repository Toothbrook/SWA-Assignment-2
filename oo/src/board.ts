
export type Generator<T>= { next:() => T } 

export type Position = {
    row: number,
    col: number
}

export type Match<T> = {
    matched: T,
    positions: Position[]
}

export type BoardEvent<T> = null;

export type BoardListener<T> = null;

export class Board<T> {
    addListener(listener: BoardListener<T>) {
    }

    piece(p: Position): T | undefined {
        return
    }

    canMove(first: Position, second: Position): boolean {
        return true
    }
    
    move(first: Position, second: Position) {
    }
}
