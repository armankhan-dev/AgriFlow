package com.agriflow.dsa;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.stereotype.Service;

@Service
public class DsaService {
    public Map<String, Object> search(String text, String query, String algorithm) {
        String mode = algorithm.toUpperCase(Locale.ROOT);
        List<Integer> matches;
        if (mode.equals("AHO_CORASICK")) {
            List<String> patterns = Arrays.stream(query.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
            matches = ahoCorasick(text, patterns);
        } else {
            String pattern = query;
            matches = switch (mode) {
                case "Z" -> zSearch(text, pattern);
                case "RABIN_KARP" -> rabinKarp(text, pattern);
                case "SUFFIX_ARRAY" -> suffixArraySearch(text, pattern);
                default -> kmp(text, pattern);
            };
        }
        return Map.of("algorithm", mode, "matches", matches, "count", matches.size());
    }

    public Map<String, Object> compare(String left, String right) {
        return Map.of("levenshteinDistance", levenshtein(left, right),
                "smithWatermanScore", smithWaterman(left, right),
                "suffixArrayLcp", longestCommonSubstringKasai(left, right));
    }

    public Map<String, Object> waterFlow(int nodes, List<Edge> edges, int source, int sink) {
        if (nodes < 2 || source < 0 || sink < 0 || source >= nodes || sink >= nodes || source == sink) {
            throw new IllegalArgumentException("Choose distinct source and sink nodes in the network.");
        }
        int[][] capacity = new int[nodes][nodes];
        for (Edge edge : edges) {
            if (edge.from() < 0 || edge.to() < 0 || edge.from() >= nodes || edge.to() >= nodes
                    || edge.capacity() < 0) throw new IllegalArgumentException("Invalid pipeline edge.");
            capacity[edge.from()][edge.to()] += edge.capacity();
        }
        int[][] residual = Arrays.stream(capacity).map(int[]::clone).toArray(int[][]::new);
        int flow = 0;
        int[] parent = new int[nodes];
        while (findAugmentingPath(residual, source, sink, parent)) {
            int pathFlow = Integer.MAX_VALUE;
            for (int node = sink; node != source; node = parent[node]) {
                pathFlow = Math.min(pathFlow, residual[parent[node]][node]);
            }
            for (int node = sink; node != source; node = parent[node]) {
                residual[parent[node]][node] -= pathFlow;
                residual[node][parent[node]] += pathFlow;
            }
            flow += pathFlow;
        }
        boolean[] reachable = new boolean[nodes];
        markReachable(residual, source, reachable);
        List<Integer> cut = new ArrayList<>();
        for (int i = 0; i < nodes; i++) if (reachable[i]) cut.add(i);
        return Map.of("algorithm", "Edmonds-Karp / Max-Flow Min-Cut", "maxFlow", flow, "sourceSideOfMinCut", cut);
    }

    public List<Integer> reservoirSample(List<Integer> stream, int size) {
        if (size < 0) throw new IllegalArgumentException("Sample size cannot be negative.");
        List<Integer> sample = new ArrayList<>(Math.min(size, stream.size()));
        for (int i = 0; i < stream.size(); i++) {
            if (i < size) sample.add(stream.get(i));
            else {
                int replace = ThreadLocalRandom.current().nextInt(i + 1);
                if (replace < size) sample.set(replace, stream.get(i));
            }
        }
        return sample;
    }

    private List<Integer> kmp(String text, String pattern) {
        List<Integer> hits = new ArrayList<>();
        if (pattern.isEmpty()) return hits;
        int[] prefix = prefixFunction(pattern);
        for (int i = 0, j = 0; i < text.length(); i++) {
            while (j > 0 && text.charAt(i) != pattern.charAt(j)) j = prefix[j - 1];
            if (text.charAt(i) == pattern.charAt(j)) j++;
            if (j == pattern.length()) { hits.add(i - j + 1); j = prefix[j - 1]; }
        }
        return hits;
    }

    private int[] prefixFunction(String pattern) {
        int[] prefix = new int[pattern.length()];
        for (int i = 1, j = 0; i < pattern.length(); i++) {
            while (j > 0 && pattern.charAt(i) != pattern.charAt(j)) j = prefix[j - 1];
            if (pattern.charAt(i) == pattern.charAt(j)) j++;
            prefix[i] = j;
        }
        return prefix;
    }

    private List<Integer> zSearch(String text, String pattern) {
        List<Integer> hits = new ArrayList<>();
        if (pattern.isEmpty()) return hits;
        String joined = pattern + '\u0000' + text;
        int[] z = new int[joined.length()];
        for (int i = 1, left = 0, right = 0; i < joined.length(); i++) {
            if (i <= right) z[i] = Math.min(right - i + 1, z[i - left]);
            while (i + z[i] < joined.length() && joined.charAt(z[i]) == joined.charAt(i + z[i])) z[i]++;
            if (i + z[i] - 1 > right) { left = i; right = i + z[i] - 1; }
            if (z[i] >= pattern.length()) hits.add(i - pattern.length() - 1);
        }
        return hits;
    }

    private List<Integer> rabinKarp(String text, String pattern) {
        List<Integer> hits = new ArrayList<>();
        if (pattern.isEmpty() || pattern.length() > text.length()) return hits;
        long base = 257, modulus = 1_000_000_007L, high = 1, targetHash = 0, windowHash = 0;
        for (int i = 1; i < pattern.length(); i++) high = high * base % modulus;
        for (int i = 0; i < pattern.length(); i++) {
            targetHash = (targetHash * base + pattern.charAt(i)) % modulus;
            windowHash = (windowHash * base + text.charAt(i)) % modulus;
        }
        for (int start = 0; start <= text.length() - pattern.length(); start++) {
            if (targetHash == windowHash && text.regionMatches(start, pattern, 0, pattern.length())) hits.add(start);
            if (start < text.length() - pattern.length()) {
                windowHash = (windowHash - text.charAt(start) * high % modulus + modulus) % modulus;
                windowHash = (windowHash * base + text.charAt(start + pattern.length())) % modulus;
            }
        }
        return hits;
    }

    private List<Integer> ahoCorasick(String text, List<String> patterns) {
        class Node {
            Map<Character, Node> next = new HashMap<>();
            Node fail;
            List<String> output = new ArrayList<>();
        }
        Node root = new Node();
        for (String word : patterns) {
            if (word.isEmpty()) continue;
            Node node = root;
            for (char ch : word.toLowerCase(Locale.ROOT).toCharArray()) node = node.next.computeIfAbsent(ch, ignored -> new Node());
            node.output.add(word.toLowerCase(Locale.ROOT));
        }
        ArrayDeque<Node> queue = new ArrayDeque<>();
        root.fail = root;
        root.next.values().forEach(child -> { child.fail = root; queue.add(child); });
        while (!queue.isEmpty()) {
            Node node = queue.remove();
            for (Map.Entry<Character, Node> edge : node.next.entrySet()) {
                Node fallback = node.fail;
                while (fallback != root && !fallback.next.containsKey(edge.getKey())) fallback = fallback.fail;
                edge.getValue().fail = fallback.next.getOrDefault(edge.getKey(), root);
                edge.getValue().output.addAll(edge.getValue().fail.output);
                queue.add(edge.getValue());
            }
        }
        List<Integer> hits = new ArrayList<>();
        Node node = root;
        String normalized = text.toLowerCase(Locale.ROOT);
        for (int i = 0; i < normalized.length(); i++) {
            char ch = normalized.charAt(i);
            while (node != root && !node.next.containsKey(ch)) node = node.fail;
            node = node.next.getOrDefault(ch, root);
            for (String pattern : node.output) hits.add(i - pattern.length() + 1);
        }
        hits.sort(Integer::compareTo);
        return hits;
    }

    private List<Integer> suffixArraySearch(String text, String pattern) {
        int[] suffixes = suffixArray(text);
        List<Integer> hits = new ArrayList<>();
        for (int start : suffixes) if (text.startsWith(pattern, start)) hits.add(start);
        hits.sort(Integer::compareTo);
        return hits;
    }

    private int levenshtein(String a, String b) {
        int[] previous = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) previous[j] = j;
        for (int i = 1; i <= a.length(); i++) {
            int[] current = new int[b.length() + 1];
            current[0] = i;
            for (int j = 1; j <= b.length(); j++) {
                current[j] = Math.min(Math.min(current[j - 1] + 1, previous[j] + 1),
                        previous[j - 1] + (a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1));
            }
            previous = current;
        }
        return previous[b.length()];
    }

    private int smithWaterman(String a, String b) {
        int[][] score = new int[a.length() + 1][b.length() + 1];
        int best = 0;
        for (int i = 1; i <= a.length(); i++) for (int j = 1; j <= b.length(); j++) {
            score[i][j] = Math.max(0, Math.max(score[i - 1][j - 1] + (a.charAt(i - 1) == b.charAt(j - 1) ? 2 : -1),
                    Math.max(score[i - 1][j] - 1, score[i][j - 1] - 1)));
            best = Math.max(best, score[i][j]);
        }
        return best;
    }

    private int longestCommonSubstringKasai(String a, String b) {
        String combined = a + '\u0000' + b;
        int[] suffixes = suffixArray(combined);
        int[] lcp = kasaiLcp(combined, suffixes);
        int best = 0;
        for (int i = 1; i < suffixes.length; i++) {
            int left = suffixes[i - 1];
            int right = suffixes[i];
            boolean leftInFirst = left < a.length();
            boolean rightInSecond = right > a.length();
            boolean rightInFirst = right < a.length();
            boolean leftInSecond = left > a.length();
            if ((leftInFirst && rightInSecond) || (rightInFirst && leftInSecond)) {
                int firstStart = leftInFirst ? left : right;
                int secondStart = (leftInSecond ? left : right) - a.length() - 1;
                int cap = Math.min(a.length() - firstStart, b.length() - secondStart);
                best = Math.max(best, Math.min(lcp[i], cap));
            }
        }
        return best;
    }

    private int[] suffixArray(String text) {
        int length = text.length();
        Integer[] order = new Integer[length];
        int[] rank = new int[length];
        for (int i = 0; i < length; i++) {
            order[i] = i;
            rank[i] = text.charAt(i);
        }
        for (int gap = 1; gap < length; gap *= 2) {
            int[] currentRank = rank;
            int offset = gap;
            Arrays.sort(order, (left, right) -> {
                int first = Integer.compare(currentRank[left], currentRank[right]);
                if (first != 0) return first;
                int leftTail = left + offset < length ? currentRank[left + offset] : -1;
                int rightTail = right + offset < length ? currentRank[right + offset] : -1;
                return Integer.compare(leftTail, rightTail);
            });
            int[] nextRank = new int[length];
            for (int i = 1; i < length; i++) {
                int previous = order[i - 1];
                int current = order[i];
                boolean different = rank[previous] != rank[current]
                        || (previous + gap < length ? rank[previous + gap] : -1)
                        != (current + gap < length ? rank[current + gap] : -1);
                nextRank[current] = nextRank[previous] + (different ? 1 : 0);
            }
            rank = nextRank;
            if (rank[order[length - 1]] == length - 1) break;
        }
        return Arrays.stream(order).mapToInt(Integer::intValue).toArray();
    }

    private int[] kasaiLcp(String text, int[] suffixes) {
        int[] rank = new int[suffixes.length];
        for (int i = 0; i < suffixes.length; i++) rank[suffixes[i]] = i;
        int[] lcp = new int[suffixes.length];
        for (int start = 0, common = 0; start < text.length(); start++) {
            int order = rank[start];
            if (order == 0) {
                common = 0;
                continue;
            }
            int previous = suffixes[order - 1];
            while (start + common < text.length() && previous + common < text.length()
                    && text.charAt(start + common) == text.charAt(previous + common)) common++;
            lcp[order] = common;
            if (common > 0) common--;
        }
        return lcp;
    }

    private boolean findAugmentingPath(int[][] residual, int source, int sink, int[] parent) {
        Arrays.fill(parent, -1);
        parent[source] = source;
        ArrayDeque<Integer> queue = new ArrayDeque<>();
        queue.add(source);
        while (!queue.isEmpty()) {
            int from = queue.remove();
            for (int to = 0; to < residual.length; to++) {
                if (parent[to] == -1 && residual[from][to] > 0) {
                    parent[to] = from;
                    if (to == sink) return true;
                    queue.add(to);
                }
            }
        }
        return false;
    }

    private void markReachable(int[][] residual, int from, boolean[] seen) {
        seen[from] = true;
        for (int to = 0; to < residual.length; to++) if (residual[from][to] > 0 && !seen[to]) markReachable(residual, to, seen);
    }

    public record Edge(int from, int to, int capacity) {
    }
}