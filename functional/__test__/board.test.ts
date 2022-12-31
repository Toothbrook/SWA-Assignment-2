import { describe, it, expect, beforeEach } from '@jest/globals'
import { BoardEffect, Generator } from '../src/board'
import * as Board from '../src/board'

class CyclicGenerator implements Generator<string> {
    private sequence: string
    private index: number

    constructor(sequence: string) {
        this.sequence = sequence
        this.index = 0
    }

    next(): string {
        const n = this.sequence.charAt(this.index)
        this.index = (this.index + 1) % this.sequence.length
        return n
    }
}

class GeneratorFake<T> implements Generator<T> {
    private upcoming: T[]

    constructor(...upcoming: T[]) {
        this.upcoming = upcoming
    }

    prepare(...e: T[]) {
        this.upcoming.push(...e)
    }

    next(): T {
        let v = this.upcoming.shift()
        if (v === undefined) 
            throw new Error('Empty queue')
        else
            return v
    }

}

 function require(board: Board.Board<String>) {
     function toEqual(...tiles: String[]) {
         for(let row: number = 0; row < board.height; row++) {
             for(let col: number = 0; col < board.width; col ++) {
                 expect(Board.tilePiece(board, {row, col})).toEqual(tiles[row * board.width + col])
             }
         }
     }
     return { toEqual }
 }

describe("Board", () => {
    describe("Initial board", () => {
        const generator = new CyclicGenerator('ABC')
        const board = Board.create(generator, 2, 3)

        it("has the given width", () => {
            expect(board.width).toEqual(2)
        })

        it("has the given height", () => {
            expect(board.height).toEqual(3)
        })
        it("contains the generated elements", () => {
            expect(Board.tilePiece(board, {row: 0, col: 0})).toEqual('A')
            expect(Board.tilePiece(board, {row: 1, col: 1})).toEqual('A')
            expect(Board.tilePiece(board, {row: 0, col: 1})).toEqual('B')
            expect(Board.tilePiece(board, {row: 2, col: 0})).toEqual('B')
            expect(Board.tilePiece(board, {row: 1, col: 0})).toEqual('C')
            expect(Board.tilePiece(board, {row: 2, col: 1})).toEqual('C')
        })
        it("is undefined outside of the board", () => {
            expect(Board.tilePiece(board, {row: 0, col: -1})).toBeUndefined()
            expect(Board.tilePiece(board, {row: -1, col: 0})).toBeUndefined()
            expect(Board.tilePiece(board, {row: 0, col: 2})).toBeUndefined()
            expect(Board.tilePiece(board, {row: 3, col: 0})).toBeUndefined()
        })
    })

    describe("moves", () => {
        describe("valid moves", () => {
            const generator = new GeneratorFake<String>(
                'A', 'B', 'A', 'C',
                'D', 'C', 'A', 'C',
                'D', 'A', 'D', 'D',
                'C', 'C', 'D', 'C'
            )
            const board = Board.create(generator, 4, 4)
            describe("valid vertical moves", () => {
                it("recognizes vertical moves that moves first tilePiece to a horizontal match as valid", () => {
                    expect(Board.canMove(board, {row: 2, col: 1}, {row: 0, col: 1})).toEqual(true)
                })
                it("recognizes vertical moves that moves second tilePiece to a horizontal match as valid", () => {
                    expect(Board.canMove(board, {row: 0, col: 1}, {row: 2, col: 1})).toEqual(true)
                })
                it("recognizes vertical moves that moves first tilePiece to a vertical match as valid", () => {
                    expect(Board.canMove(board, {row: 3, col: 3}, {row: 2, col: 3})).toEqual(true)
                })
                it("recognizes vertical moves that moves second tilePiece to a vertical match as valid", () => {
                    expect(Board.canMove(board, {row: 2, col: 3}, {row: 3, col: 3})).toEqual(true)
                })
            })

            describe("valid horizontal moves", () => {
                it("recognizes horizontal moves that moves first tilePiece to a horizontal match as valid", () => {
                    expect(Board.canMove(board, {row: 3, col: 3}, {row: 3, col: 2})).toEqual(true)
                })
                it("recognizes horizontal moves that moves second tilePiece to a horizontal match as valid", () => {
                    expect(Board.canMove(board, {row: 3, col: 2}, {row: 3, col: 3})).toEqual(true)
                })
                it("recognizes horizontal moves that moves first tilePiece to a vertical match as valid", () => {
                    expect(Board.canMove(board, {row: 1, col: 0}, {row: 1, col: 2})).toEqual(true)
                })
                it("recognizes horizontal moves that moves second tilePiece to a vertical match as valid", () => {
                    expect(Board.canMove(board, {row: 1, col: 2}, {row: 1, col: 0})).toEqual(true)
                })
            })

            describe("invalid moves", () => {
                it("does not allow moves that make no matches", () => {
                    expect(Board.canMove(board, {row: 0, col: 0}, {row: 0, col: 0})).toEqual(false)
                })
                it("does not count the tilePiece that is moved away", () => {
                    expect(Board.canMove(board, {row: 1, col: 1}, {row: 2, col: 1})).toEqual(false)
                })
                it("recognizes moves on different rows and columns as invalid", () => {
                    expect(Board.canMove(board, {row: 0, col: 3}, {row: 1, col: 2})).toEqual(false)
                })
                it("recognizes out-of-bounds moves as invalid", () =>{
                    expect(Board.canMove(board, {row: 3, col: 3}, {row: -1, col: 3})).toEqual(false)
                    expect(Board.canMove(board, {row: 3, col: 3}, {row: 3, col: -1})).toEqual(false)
                    expect(Board.canMove(board, {row: 2, col: 0}, {row: 2, col: 4})).toEqual(false)
                })
            })
        })

        describe("making moves", () => {
            let generator: GeneratorFake<String>
            let board: Board.Board<String>

            beforeEach(() => {
                generator = new GeneratorFake<String>(
                    'A', 'B', 'A', 'C', 'F',
                    'D', 'B', 'C', 'C', 'A',
                    'D', 'A', 'C', 'B', 'F',
                    'C', 'D', 'D', 'C', 'D'
                )
                board = Board.create(generator, 5, 4)
            })

            it("moves the pieces during a move", () => {
                generator.prepare('C', 'D', 'A')
                board = Board.move(generator, board, {row: 2, col: 1}, {row: 0, col: 1}).board
                expect(Board.tilePiece(board, {row: 2, col: 1})).toEqual('B')
            })
            it("finds single horizontal match when moving first tilePiece to a match", () => {
                generator.prepare('C', 'D', 'A')
                expect(Board.move(generator, board, {row: 2, col: 1}, {row: 0, col: 1}).boardEffects.slice(0, 1))
                    .toEqual([{kind: 'Match', match: {matched: 'A', positions: [{row: 0, col: 0}, {row: 0, col: 1}, {row: 0, col: 2}]}}])
            })
            it("finds single horizontal match when moving second tilePiece to a match", () => {
                generator.prepare('C', 'D', 'A')
                expect(Board.move(generator, board, {row: 0, col: 1}, {row: 2, col: 1}).boardEffects.slice(0, 1))
                    .toEqual([{kind: 'Match', match: {matched: 'A', positions: [{row: 0, col: 0}, {row: 0, col: 1}, {row: 0, col: 2}]}}])
            })
            it("finds single vertical match when moving first tilePiece to a match", () => {
                generator.prepare('C', 'D', 'A')
                expect(Board.move(generator, board, {row: 3, col: 3}, {row: 2, col: 3}).boardEffects.slice(0, 1))
                    .toEqual([{kind: 'Match', match: {matched: 'C', positions: [{row: 0, col: 3}, {row: 1, col: 3}, {row: 2, col: 3}]}}])
            })
            it("finds single vertical match when moving second tilePiece to a match", () => {
                generator.prepare('C', 'D', 'A')
                expect(Board.move(generator, board, {row: 2, col: 3}, {row: 3, col: 3}).boardEffects.slice(0, 1))
                    .toEqual([{kind: 'Match', match: {matched: 'C', positions: [{row: 0, col: 3}, {row: 1, col: 3}, {row: 2, col: 3}]}}])
            })
            it("fires multiple events on horz + vert matches", () => {
                generator.prepare('G', 'H', 'I')
                generator.prepare('J', 'K', 'L')
                generator.prepare('J', 'K', 'L')
                expect(Board.move(generator, board, {row: 3, col: 4}, {row: 3, col: 0}).boardEffects.slice(0, 2)).toEqual([
                    {kind: 'Match', match: {matched: 'D', positions: [{row: 3, col: 0}, {row: 3, col: 1}, {row: 3, col: 2}]}},
                    {kind: 'Match', match: {matched: 'D', positions: [{row: 1, col: 0}, {row: 2, col: 0}, {row: 3, col: 0}]}},
                ])
            })
            it("fires multiple events when both pieces make new matches", () => {
                generator.prepare('C', 'D', 'A')
                generator.prepare('B', 'A', 'B')
                expect(Board.move(generator, board, {row: 3, col: 2}, {row: 3, col: 0}).boardEffects.slice(0, 2)).toEqual([
                    {kind: 'Match', match: {matched: 'C', positions: [{row: 1, col: 2}, {row: 2, col: 2}, {row: 3, col: 2}]}},
                    {kind: 'Match', match: {matched: 'D', positions: [{row: 1, col: 0}, {row: 2, col: 0}, {row: 3, col: 0}]}},
                ])
            })
            it("doesn't swap on illegal moves", () => {
                generator.prepare('C', 'D', 'A', 'C', 'D', 'A', 'C', 'D', 'A')
                board = Board.move(generator, board, {row: 1, col: 1}, {row: 2, col: 1}).board
                expect(Board.tilePiece(board, {row: 1, col: 1})).toEqual('B')
                board = Board.move(generator, board, {row: 0, col: 3}, {row: 1, col: 2}).board
                expect(Board.tilePiece(board, {row: 0, col: 3})).toEqual('C')
                board = Board.move(generator, board, {row: 3, col: 3}, {row: -1, col: 3}).board
                expect(Board.tilePiece(board, {row: 3, col: 3})).toEqual('C')
            })
            it("doesn't fire events on illegal moves", () => {
                generator.prepare('C', 'D', 'A', 'C', 'D', 'A', 'C', 'D', 'A')
                expect(Board.move(generator, board, {row: 0, col: 0}, {row: 0, col: 0}).boardEffects).toEqual([])
                expect(Board.move(generator, board, {row: 1, col: 1}, {row: 2, col: 1}).boardEffects).toEqual([])
                expect(Board.move(generator, board, {row: 0, col: 3}, {row: 1, col: 2}).boardEffects).toEqual([])
                expect(Board.move(generator, board, {row: 3, col: 3}, {row: -1, col: 3}).boardEffects).toEqual([])
            })
        })

        describe("replacing tiles", () => {
            let generator: GeneratorFake<String>
            let board: Board.Board<String>

            beforeEach(() => {
                generator = new GeneratorFake<String>(
                    'A', 'B', 'A',
                    'D', 'B', 'C',
                    'D', 'A', 'C',
                    'C', 'D', 'D',
                )
                board = Board.create(generator, 3, 4)
            })

            it("replaces missing top row with generated tiles", () => {
                generator.prepare('B', 'C', 'D')
                require(Board.move(generator, board, {row: 0, col: 1}, {row: 2, col: 1}).board).toEqual(
                    'B', 'C', 'D',
                    'D', 'B', 'C',
                    'D', 'B', 'C',
                    'C', 'D', 'D',
                )
            })

            it("shifts tiles down before replacing", () => {
                generator.prepare('B', 'C', 'D')
                require(Board.move(generator, board, {row: 2, col: 0}, {row: 3, col: 0}).board).toEqual(
                    'B', 'C', 'D',
                    'A', 'B', 'A',
                    'D', 'B', 'C',
                    'C', 'A', 'C',
                )
            })

            it("shifts tiles down before replacing multiple matches", () => {
                generator.prepare('D', 'B', 'C', 'A', 'B', 'A')
                require(Board.move(generator, board, {row: 3, col: 0}, {row: 3, col: 2}).board).toEqual(
                    'B', 'B', 'A',
                    'C', 'B', 'A',
                    'D', 'A', 'B',
                    'A', 'D', 'A',
                )
            })

            it("only deletes a double match once", () => {
                generator = new GeneratorFake<String>(
                    'D', 'B', 'A',
                    'D', 'B', 'C',
                    'B', 'A', 'B',
                    'C', 'B', 'D',
                )
                board = Board.create(generator, 3, 4)
                generator.prepare('D', 'C', 'B', 'B', 'A')
                require(Board.move(generator, board, {row: 0, col: 1}, {row: 2, col: 1}).board).toEqual(
                    'C', 'A', 'B',
                    'D', 'B', 'A',
                    'D', 'D', 'C',
                    'C', 'A', 'D',
                )
            })
        })

        describe("Refill event", () => {
            let generator: GeneratorFake<String>
            let board: Board.Board<String>

            beforeEach(() => {
                generator = new GeneratorFake<String>(
                    'A', 'B', 'A', 'C', 'F',
                    'D', 'B', 'C', 'C', 'A',
                    'D', 'A', 'C', 'B', 'F',
                    'C', 'D', 'D', 'C', 'D'
                )
                board = Board.create(generator, 5, 4)
            })

            it("fires refill event after shifting", () => {
                generator.prepare('B', 'C', 'D')
                const { boardEffects } = Board.move(generator, board, {row: 0, col: 1}, {row: 2, col: 1})
                expect(boardEffects[boardEffects.length - 1].kind).toEqual('Refill')
            })

            it("fires nothing with no matches", () => {
                generator.prepare('C', 'D', 'A', 'C', 'D', 'A', 'C', 'D', 'A')
                expect(Board.move(generator, board, {row: 0, col: 0}, {row: 0, col: 0}).boardEffects).toEqual([])
                expect(Board.move(generator, board, {row: 1, col: 1}, {row: 2, col: 1}).boardEffects).toEqual([])
                expect(Board.move(generator, board, {row: 0, col: 3}, {row: 1, col: 2}).boardEffects).toEqual([])
                expect(Board.move(generator, board, {row: 3, col: 3}, {row: -1, col: 3}).boardEffects).toEqual([])
            })
        })

        describe("Cascading", () => {
            let generator: GeneratorFake<String>
            let board: Board.Board<String>

            beforeEach(() => {
                generator = new GeneratorFake<String>(
                    'A', 'B', 'A',
                    'D', 'B', 'C',
                    'D', 'A', 'C',
                    'C', 'D', 'D',
                )
                board = Board.create(generator, 3, 4)
            })

            // To not put constrains on the Board kind.
            const forgetBoard = (bE: BoardEffect<String>) => {
                if (bE.kind === 'Match') {
                    return bE
                } else {
                    return { kind: bE.kind }
                }
            }
            it("registers if refilling brings new matches", () => {
                generator.prepare('B', 'C', 'C')
                generator.prepare('A', 'A', 'D')
                expect(Board.move(generator, board, {row: 0, col: 1}, {row: 2, col: 1}).boardEffects.map(forgetBoard)).toEqual([
                    {kind: 'Match', match: {matched: 'A', positions: [{row: 0, col: 0}, {row: 0, col: 1}, {row: 0, col: 2}]}},
                    {kind: 'Refill'},
                    {kind: 'Match', match: {matched: 'C', positions: [{row: 0, col: 2}, {row: 1, col: 2}, {row: 2, col: 2}]}},
                    {kind: 'Refill'},
                ])
            })

            it("iterates until there are no new matches", () => {
                generator.prepare('B', 'C', 'C')
                generator.prepare('A', 'A', 'A')
                generator.prepare('A', 'A', 'D')
                expect(Board.move(generator, board, {row: 0, col: 1}, {row: 2, col: 1}).boardEffects.map(forgetBoard)).toEqual([
                    {kind: 'Match', match: {matched: 'A', positions: [{row: 0, col: 0}, {row: 0, col: 1}, {row: 0, col: 2}]}},
                    {kind: 'Refill'},
                    {kind: 'Match', match: {matched: 'C', positions: [{row: 0, col: 2}, {row: 1, col: 2}, {row: 2, col: 2}]}},
                    {kind: 'Refill'},
                    {kind: 'Match', match: {matched: 'A', positions: [{row: 0, col: 2}, {row: 1, col: 2}, {row: 2, col: 2}]}},
                    {kind: 'Refill'},
                ])
            })
        })
    })
})