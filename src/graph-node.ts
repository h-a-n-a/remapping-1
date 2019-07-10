import binarySearch from './binary-search';
import FastStringArray from './fast-string-array';
import OriginalSource from './original-source';
import { DecodedSourceMap, SourceMapSegment, SourceMapSegmentObject } from './types';

type Graph = OriginalSource | GraphNode;

export default class GraphNode {
  map: DecodedSourceMap;
  sources: Graph[];

  constructor(map: DecodedSourceMap, sources: Graph[]) {
    this.map = map;
    this.sources = sources;
  }

  traceMappings(): DecodedSourceMap {
    const mappings: SourceMapSegment[][] = [];
    const names = new FastStringArray();
    const sources = new FastStringArray();
    const sourcesContent: (string | null)[] = [];

    const { mappings: mapMappings, names: mapNames } = this.map;
    for (let i = 0; i < mapMappings.length; i++) {
      const line = mapMappings[i];
      const tracedLine: SourceMapSegment[] = [];

      for (let i = 0; i < line.length; i++) {
        const segment = line[i];

        if (segment.length === 1) continue;
        const source = this.sources[segment[1]];

        const traced = source.traceSegment(
          segment[2],
          segment[3],
          // TODO: Is this necessary?
          segment.length === 5 ? mapNames[segment[4]] : ''
        );

        if (!traced) continue;

        const { name } = traced;
        const { filename, content } = traced.source;

        const sourceIndex = sources.put(filename);
        sourcesContent[sourceIndex] = content;

        if (name) {
          tracedLine.push([segment[0], sourceIndex, traced.line, traced.column, names.put(name)]);
        } else {
          tracedLine.push([segment[0], sourceIndex, traced.line, traced.column]);
        }
      }

      mappings.push(tracedLine);
    }

    return Object.assign({}, this.map, {
      mappings,
      names: names.array,
      sources: sources.array,
      sourcesContent,
    });
  }

  traceSegment(
    line: number,
    column: number,
    name: string
  ): SourceMapSegmentObject<OriginalSource> | null {
    const segments = this.map.mappings[line];
    if (!segments) return null;

    const index = binarySearch(segments, column, (segment, column) => {
      return segment[0] - column;
    });
    if (index < 0) {
      return null;
    }

    const segment = segments[index];
    if (segment.length === 1) return null;

    const source = this.sources[segment[1]];
    return source.traceSegment(
      segment[2],
      segment[3],
      segment.length === 5 ? this.map.names[segment[4]] : name
    );
  }
}
