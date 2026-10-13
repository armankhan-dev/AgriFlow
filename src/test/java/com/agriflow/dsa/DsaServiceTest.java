package com.agriflow.dsa;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class DsaServiceTest {
    private final DsaService service = new DsaService();

    @Test
    void stringSearchAlgorithmsFindOverlappingMatches() {
        assertEquals(List.of(0, 2, 4), service.search("abababa", "aba", "KMP").get("matches"));
        assertEquals(List.of(0, 1, 2, 3), service.search("aaaaa", "aa", "Z").get("matches"));
        assertEquals(List.of(0, 2), service.search("ababa", "aba", "RABIN_KARP").get("matches"));
    }

    @Test
    void ahoCorasickReportsPatternStartOffsets() {
        Map<String, Object> result = service.search("Tomato blight and early blight", "tomato,blight", "AHO_CORASICK");
        assertEquals(List.of(0, 7, 24), result.get("matches"));
    }

    @Test
    void suffixArraySearchAndKasaiFindSharedPhrase() {
        assertEquals(List.of(1, 3, 11), service.search("banana bandana", "ana", "SUFFIX_ARRAY").get("matches"));
        assertEquals(5, service.compare("banana", "ananas").get("suffixArrayLcp"));
    }

    @Test
    void edmondsKarpFindsMaximumFlowAndReservoirKeepsRequestedSize() {
        List<DsaService.Edge> edges = List.of(
                new DsaService.Edge(0, 1, 16), new DsaService.Edge(0, 2, 13),
                new DsaService.Edge(1, 2, 10), new DsaService.Edge(2, 1, 4),
                new DsaService.Edge(1, 3, 12), new DsaService.Edge(3, 2, 9),
                new DsaService.Edge(2, 4, 14), new DsaService.Edge(4, 3, 7),
                new DsaService.Edge(3, 5, 20), new DsaService.Edge(4, 5, 4));
        assertEquals(23, service.waterFlow(6, edges, 0, 5).get("maxFlow"));
        assertEquals(5, service.reservoirSample(List.of(1, 2, 3, 4, 5, 6, 7), 5).size());
        assertTrue(service.reservoirSample(List.of(1, 2), 5).containsAll(List.of(1, 2)));
    }
}