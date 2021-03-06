/// <reference path="../types/jquery.d.ts" />
/// <reference path="../types/awesomeCursor.d.ts" />
/// <reference path="play.ts" />
/// <reference path="play.cell.ts" />
/// <reference path="play.train.ts" />
/// <reference path="play.board.renderer.ts" />

module trains.play {

    export var gridSize: number = 40;
    export var gridColour: string = "#eee";

    export var trackWidth = 4;
    export var trackPadding = 10;
    export var firstTrackPosY = trackPadding;
    export var secondTrackPosY = trains.play.gridSize - trackPadding;

    export class Board {

        private $window: JQuery;

        private trainCanvas: HTMLCanvasElement;
        public trainContext: CanvasRenderingContext2D;
        private trackCanvas: HTMLCanvasElement;
        public trackContext: CanvasRenderingContext2D;
        private gridCanvas: HTMLCanvasElement;
        private gridContext: CanvasRenderingContext2D;

        public canvasWidth: number;
        public canvasHeight: number;

        private cells: trains.play.BoardCells = {};
        private tool: Tool;
        
        private trains = new Array<trains.play.Train>();
        
        public firstCell: trains.play.Cell;
        
        constructor(public playComponents: trains.play.PlayComponents) {

            this.$window = $(window);

            this.trainCanvas = <HTMLCanvasElement>this.playComponents.$trainCanvas.get(0);
            this.trainContext = this.trainCanvas.getContext("2d");

            this.trackCanvas = <HTMLCanvasElement>this.playComponents.$trackCanvas.get(0);
            this.trackContext = this.trackCanvas.getContext("2d");

            this.gridCanvas = <HTMLCanvasElement>this.playComponents.$gridCanvas.get(0);
            this.gridContext = this.gridCanvas.getContext("2d");

            this.canvasWidth = this.roundToNearestGridSize(this.$window.width() - (gridSize * 2));
            this.canvasHeight = this.roundToNearestGridSize(this.$window.height() - (gridSize * 2));

            this.playComponents.$canvases.attr('width', this.canvasWidth);
            this.playComponents.$canvases.attr('height', this.canvasHeight);
            this.playComponents.$canvases.width(this.canvasWidth);
            this.playComponents.$canvases.css('top', (this.$window.height() - this.canvasHeight) / 2);
            this.playComponents.$canvases.css('left', (this.$window.width() - this.canvasWidth) / 2);

            [this.trackCanvas, this.trainCanvas].forEach(el => {            
                el.addEventListener('click', (event: MouseEvent) => this.cellClick(event));
                el.addEventListener('mousemove', (event: MouseEvent) => this.cellMoveOver(event));
                el.addEventListener('touchstart', (event: any) => false);
                el.addEventListener('touchmove', (event: any) => {
                    this.cellTouch(event);
                    event.preventDefault();
                    return false;
                });
                el.addEventListener('contextmenu', (ev) => {
                    this.cellRightClick(ev);
                    ev.preventDefault();
                    return false; }, false);
            });
            this.setTool(trains.play.Tool.Track);
            
            trains.play.BoardRenderer.drawGrid(this.gridContext, this.canvasWidth, this.canvasHeight);
        }
        
        redraw(): void {
            trains.play.BoardRenderer.redrawCells(this.cells, this.trackContext, this.canvasWidth, this.canvasHeight);
        }            

        setTool(tool: Tool): void {
            if (tool !== this.tool) {
                this.tool = tool;
                
                var cursorName;
                switch (tool) {
                    case trains.play.Tool.Track: {
                        cursorName = "pencil";
                        break;
                    }
                    case trains.play.Tool.Train: {
                        cursorName = "train";
                        break;
                    }
                    case trains.play.Tool.Eraser: {
                        cursorName = "eraser";
                        break;
                    }
                    case trains.play.Tool.Rotate: {
                        cursorName = "refresh";
                        break;
                    }
                }
                
                $('body').css('cursor', '');
                $('body').awesomeCursor(cursorName, {
                    hotspot: 'bottom left'
                })
            }
        }
        
        private cellMoveOver(event: MouseEvent): void {
            if (event.buttons === 1) {
                this.cellClick(event);
            }
        }

        private cellTouch(event: any): void {
            var column = this.getGridCoord(event.touches[0].pageX - this.trackCanvas.offsetLeft);
            var row = this.getGridCoord(event.touches[0].pageY - this.trackCanvas.offsetTop);
            this.doTool(column, row, event.shiftKey);
        }
        
        private cellRightClick(event: MouseEvent): void {
            var column = this.getGridCoord(event.pageX - this.trackCanvas.offsetLeft);
            var row = this.getGridCoord(event.pageY - this.trackCanvas.offsetTop);
            this.eraseTrack(column, row);
        }
        
        private cellClick(event: MouseEvent): void {
            var column = this.getGridCoord(event.pageX - this.trackCanvas.offsetLeft);
            var row = this.getGridCoord(event.pageY - this.trackCanvas.offsetTop);

            this.doTool(column, row, event.shiftKey);
        }
        
        private doTool(column: number, row: number, shift: boolean): void {
            switch (this.tool) {
                case Tool.Track:
                {
                    if (shift) {
                        this.rotateTrack(column, row);
                    } else {
                        this.newTrack(column, row);
                    }
                    break;
                }
                case Tool.Eraser:
                {
                    this.eraseTrack(column, row);
                    break;
                }
                case Tool.Rotate:
                {
                    this.rotateTrack(column, row);
                    break;    
                }
                case Tool.Train:
                {
                    var cellID = this.getCellID(column, row);

                    if (this.cells[cellID] !== undefined) {
                        var t = new Train(this, this.cells[cellID]);
                        this.trains.push(t);
                    }
                    break;    
                }        
            }
        }
        
        public destroyTrack(): void {
            
            this.trains.forEach(t=> t.stop());
            this.trains = new Array<Train>();
            var deferreds = new Array<JQueryDeferred<{}>>();
            for (var id in this.cells) {
                if (this.cells.hasOwnProperty(id)) {
                    if (!isNaN(id)) {
                        deferreds.push(this.cells[id].destroy());
                    }
                }
            }

            $.when.apply($, deferreds).done(() => {
                trains.play.BoardRenderer.clearCells(this.trackContext, this.canvasWidth, this.canvasHeight);
                trains.play.BoardRenderer.clearCells(this.trainContext, this.canvasWidth, this.canvasHeight);
                this.cells = [];
            });
        }
        
        private rotateTrack(column: number, row: number): void {
            var cellID = this.getCellID(column, row);
            var cell: trains.play.Cell = this.cells[cellID];
            if (cell !== undefined) {
                if (cell.direction === trains.play.Direction.Cross) {
                    cell.direction = trains.play.Direction.Vertical;
                } else {
                    cell.direction = cell.direction + 1;
                }
                cell.draw(this.trackContext);
                var neighbours = this.getNeighbouringCells(cell.column, cell.row);
                neighbours.all.forEach((neighbour) => {
                    neighbour.draw(this.trackContext);
                });
            }
        }

        private newTrack(column: number, row: number): void {
            var cellID = this.getCellID(column, row);

            if (this.cells[cellID] === undefined) {
                
                var newCell = new trains.play.Cell(this, cellID, column, row);
                
                if (this.firstCell === undefined) {
                    this.firstCell = newCell;
                }  
                
                this.cells[newCell.id] = newCell;

                newCell.checkYourself();
            }
        }

        private eraseTrack(column: number, row: number): void {
            var cellID = this.getCellID(column, row);

            var cell = this.cells[cellID];            
            if (cell !== undefined) {
                delete this.cells[cellID];
                cell.destroy().done(() => {
                    var neighbours = this.getNeighbouringCells(column, row, true);

                    // some of my neighbours may need to be less happy now
                    if (neighbours.up !== undefined && neighbours.up.happy && neighbours.up.isConnectedDown()) neighbours.up.happy = false;
                    if (neighbours.down !== undefined && neighbours.down.happy && neighbours.down.isConnectedUp()) neighbours.down.happy = false;
                    if (neighbours.left !== undefined && neighbours.left.happy && neighbours.left.isConnectedRight()) neighbours.left.happy = false;
                    if (neighbours.right !== undefined && neighbours.right.happy && neighbours.right.isConnectedLeft()) neighbours.right.happy = false;
                    
                    neighbours.all.forEach(n => n.checkYourself()); 
                });
            }
        }
        
        showChooChoo(): void {
            this.trains.forEach(t=>t.start());
        }
        
        stopChooChoo(): void {
            this.trains.forEach(t=>t.stop());
        }

        private roundToNearestGridSize(value: number): number {
            return Math.floor(value / gridSize) * gridSize;
        }

        getGridCoord(value: number): number {
            return Math.floor(value / gridSize);
        }

        getCellID(column: number, row: number): string {
            return column.toString() + ':' + row.toString();
        }
        
        getCell(column: number, row: number): trains.play.Cell {
            return this.cells[this.getCellID(column, row)];
        }

        getNeighbouringCells(column: number, row: number, includeHappyNeighbours: boolean = false): trains.play.NeighbouringCells {
            var up = this.cells[this.getCellID(column, row - 1)];
            var right = this.cells[this.getCellID(column + 1, row)];
            var down = this.cells[this.getCellID(column, row + 1)];
            var left = this.cells[this.getCellID(column - 1, row)];

            // if any of the neighbours are happy, and not happy with us, then we need to ignore them
            if (!includeHappyNeighbours) {
                if (up !== undefined && up.happy && !up.isConnectedDown()) up = undefined;
                if (right !== undefined && right.happy && !right.isConnectedLeft()) right = undefined;
                if (down !== undefined && down.happy && !down.isConnectedUp()) down = undefined;
                if (left !== undefined && left.happy && !left.isConnectedRight()) left = undefined;
            }
            
            var all = [up, right, down, left].filter(n => n !== undefined);
            
            return {
                up: up,
                right: right,
                down: down,
                left: left,
                all: all
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
        all: Array<trains.play.Cell>;
    }

    export enum Tool {
        Track,
        Eraser,
        Rotate,
        Train
    }

    export enum Direction {
        None,
        Vertical,
        Horizontal,
        RightUp,
        RightDown,
        LeftDown,
        LeftUp,
        Cross
    }

}