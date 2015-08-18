/// <reference path="../types/jquery.d.ts" />
/// <reference path="play.cell.ts" />
/// <reference path="play.board.renderer.ts" />

module trains.play {

    export var gridSize: number = 40;
    export var gridColour: string = "#ddd";

    export var trackWidth = 4;
    export var trackPadding = 10;
    export var firstTrackPosY = trackPadding;
    export var secondTrackPosY = trains.play.gridSize - trackPadding;

    export class Board {

        private $window: JQuery;
        private $canvases: JQuery;

        private trainCanvas: HTMLCanvasElement;
        public trainContext: CanvasRenderingContext2D;
        private gridCanvas: HTMLCanvasElement;
        private gridContext: CanvasRenderingContext2D;

        private canvasWidth: number;
        private canvasHeight: number;

        private cells: trains.play.BoardCells = {};
        private tool: Tool = trains.play.Tool.Track;

        constructor(private $trainCanvas: JQuery, private $gridCanvas: JQuery) {

            this.$window = $(window);
            this.$canvases = $().add($trainCanvas).add($gridCanvas);

            this.trainCanvas = <HTMLCanvasElement>this.$trainCanvas.get(0);
            this.trainContext = this.trainCanvas.getContext("2d");

            this.gridCanvas = <HTMLCanvasElement>this.$gridCanvas.get(0);
            this.gridContext = this.gridCanvas.getContext("2d");

            this.canvasWidth = this.roundToNearestGridSize(this.$window.width() - (gridSize * 2));
            this.canvasHeight = this.roundToNearestGridSize(this.$window.height() - (gridSize * 2));

            this.$canvases.attr('width', this.canvasWidth);
            this.$canvases.attr('height', this.canvasHeight);
            this.$canvases.width(this.canvasWidth);
            this.$canvases.css('top', (this.$window.height() - this.canvasHeight) / 2);
            this.$canvases.css('left', (this.$window.width() - this.canvasWidth) / 2);

            this.trainCanvas.addEventListener('click', (event: MouseEvent) => this.cellClick(event));

            trains.play.BoardRenderer.drawGrid(this.gridContext, this.canvasWidth, this.canvasHeight);
        }

        setTool(tool: Tool): void {
            this.tool = tool;
        }

        private cellClick(event: MouseEvent): void {

            var column = this.getGridCoord(event.pageX - this.trainCanvas.offsetLeft);
            var row = this.getGridCoord(event.pageY - this.trainCanvas.offsetTop);

            switch (this.tool) {
                case Tool.Track:
                {
                    this.newTrack(column, row);
                    break;
                }
                case Tool.Eraser:
                {
                    this.eraseTrack(column, row);
                    break;
                }
            }
        }

        private newTrack(column: number, row: number): void {
            var cellID = this.getCellID(column, row);

            if (this.cells[cellID] === undefined) {
                var newCell = new trains.play.Cell(this, cellID, column, row);
                this.cells[newCell.id] = newCell;

                newCell.neighbourlyUpdateTime(this.getNeighbouringCells(column, row), []);

                trains.play.BoardRenderer.redrawCells(this.cells, this.trainContext, this.canvasWidth, this.canvasHeight);
            }
        }

        private eraseTrack(column: number, row: number): void {
            var cellID = this.getCellID(column, row);

            if (this.cells[cellID] !== undefined) {
                delete this.cells[cellID];
                trains.play.BoardRenderer.redrawCells(this.cells, this.trainContext, this.canvasWidth, this.canvasHeight);
            }
        }

        private roundToNearestGridSize(value: number): number {
            return Math.round(value / gridSize) * gridSize;
        }

        private getGridCoord(value: number): number {
            return Math.floor(value / gridSize);
        }

        getCellID(column: number, row: number): number {
            return Number(column.toString() + row.toString());
        }

        getNeighbouringCells(column: number, row: number): trains.play.NeighbouringCells {

            var up = this.cells[this.getCellID(column, row - 1)];
            var right = this.cells[this.getCellID(column + 1, row)];
            var down = this.cells[this.getCellID(column, row + 1)];
            var left = this.cells[this.getCellID(column - 1, row)];
            var aliveNeighbours = [up, right, down, left].filter(n => n !== undefined);

            return {
                up: up,
                right: right,
                down: down,
                left: left,
                aliveNeighbours: aliveNeighbours
            };
        }
    }

    export interface BoardCells {
        [position: number]: trains.play.Cell;
    }

    export interface NeighbouringCells {
        up: trains.play.Cell;
        right: trains.play.Cell;
        down: trains.play.Cell;
        left: trains.play.Cell;
        aliveNeighbours: Array<trains.play.Cell>;
    }

    export enum Tool {
        Track,
        Eraser
    }

    export enum Direction {
        Vertical,
        Horizontal,
        RightUp,
        RightDown,
        LeftDown,
        LeftUp
    }

}