package sample;

import client.ServerListener;
import java.io.IOException;
import java.io.InputStream;
import javafx.application.Platform;
import javafx.fxml.FXML;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.image.Image;
import javafx.scene.image.ImageView;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.AnchorPane;
import javafx.scene.layout.Pane;
import javafx.scene.Cursor;
import javafx.scene.effect.ColorAdjust;
import javafx.scene.Node;
import java.util.HashMap;
import java.util.Map;

import java.util.ArrayList;
import java.util.List;

public class PartieController {

    @FXML
    private FlowPane main;
    @FXML
    private VBox contractBox;
    @FXML
    private Button petite;
    @FXML
    private Button garde;
    @FXML
    private Button gardeContre;
    @FXML
    private Button gardeSans;
    @FXML
    private Button refuse;
    @FXML
    private Button retrieveDog;
    @FXML
    private HBox boxRois;
    @FXML
    private HBox boxChien;
    @FXML
    private HBox boxTour;
    @FXML
    private ImageView carteCenter;
    @FXML
    private ImageView dog;
    @FXML
    private Label statusLabel;
    @FXML
    private Label labelLeft;
    @FXML
    private Label labelTopLeft;
    @FXML
    private Label labelTopRight;
    @FXML
    private Label labelRight;
    @FXML
    private Label scoreLeft;
    @FXML
    private Label scoreTopLeft;
    @FXML
    private Label scoreTopRight;
    @FXML
    private Label scoreRight;
    @FXML
    private Label scoreSelf;
    @FXML
    private AnchorPane root;
    @FXML
    private HBox teamScoreBox;
    @FXML
    private Label attackScoreLabel;
    @FXML
    private Label defenseScoreLabel;

    private ServerListener listener;
    private int tourCount = 0;
    private boolean sendingTurn = false;
    private final Map<String, String> cardColors = new HashMap<>();
    private final Map<String, Integer> cardRanks = new HashMap<>();
    private int highestAtoutCenter = 0;
    private List<Label> opponentLabels;
    private List<String> playerNames;
    private List<Label> opponentScoreLabels;
    private List<String> pendingDogIds = new ArrayList<>();
    private List<String> pendingDogLiens = new ArrayList<>();
    private List<String> pendingDogColors = new ArrayList<>();
    private static final String BASE_LABEL_STYLE = "-fx-text-fill: white; -fx-font-size: 18px; -fx-font-weight: bold;";
    private static final String CURRENT_LABEL_STYLE = "-fx-text-fill: orange; -fx-font-size: 20px; -fx-font-weight: bold;";
    private static final String ATTACK_LABEL_STYLE = "-fx-text-fill: red; -fx-font-size: 18px; -fx-font-weight: bold;";
    private static final String DEFENSE_LABEL_STYLE = "-fx-text-fill: blue; -fx-font-size: 18px; -fx-font-weight: bold;";
    private final Map<Integer, Label> labelsByPlayer = new HashMap<>();
    private final Map<Integer, String> baseStylesByPlayer = new HashMap<>();
    private int takerNum = -1;
    private int partnerNum = -1;
    private String calledKingColor;
    private List<Double> lastScores;
    private int lastCurrentPlayer;

    @FXML
    public void initialize() {
        if (root != null) {
            main.prefWrapLengthProperty().bind(root.widthProperty());
            root.widthProperty().addListener((o, ov, nv) -> resizeAllCards());
            root.heightProperty().addListener((o, ov, nv) -> resizeAllCards());
        }
    }

    public void initHand(ArrayList<String> ids, ArrayList<String> liens, ArrayList<String> colors) {
        main.setHgap(-30);
        main.setVgap(0);
        for (int i = 0; i < ids.size(); i++) {
            InputStream is = getClass().getResourceAsStream("/sample/img/" + liens.get(i));
            Image img = is != null ? new Image(is)
                                   : new Image(getClass().getResourceAsStream("/sample/img/carte.png"));
            ImageView imageCarte = new ImageView(img);
            applyCardSize(imageCarte);
            imageCarte.setId(ids.get(i));
            cardColors.put(ids.get(i), normalizeColor(colors.get(i)));
            cardRanks.put(ids.get(i), extractRank(liens.get(i)));
            main.getChildren().add(imageCarte);
        }
        sortHand();
        resizeAllCards();
    }

    private int extractRank(String lien) {
        try {
            String file = lien.substring(lien.lastIndexOf('/') + 1);
            String value = file.substring(5, file.indexOf('_', 5));
            return Integer.parseInt(value);
        } catch (Exception e) {
            return 0;
        }
    }

    private void applyCardSize(ImageView img) {
        if (root == null) return;
        double scale = Math.min(root.getWidth() / 900.0, root.getHeight() / 500.0);
        if (scale <= 0) scale = 1;
        img.setFitWidth(60 * scale);
        img.setFitHeight(100 * scale);
        img.setPreserveRatio(true);
    }

    private void resizeAllCards() {
        if (root == null) return;
        double scale = Math.min(root.getWidth() / 900.0, root.getHeight() / 500.0);
        if (scale <= 0) scale = 1;
        double w = 60 * scale;
        double h = 100 * scale;
        resizeImagesIn(root, w, h);
    }

    private void resizeImagesIn(Pane pane, double w, double h) {
        if (pane == null) return;
        for (Node n : pane.getChildren()) {
            if (n instanceof ImageView) {
                ImageView iv = (ImageView) n;
                iv.setFitWidth(w);
                iv.setFitHeight(h);
            } else if (n instanceof Pane) {
                resizeImagesIn((Pane) n, w, h);
            }
        }
    }

    private void sortHand() {
        List<Node> nodes = new ArrayList<>(main.getChildren());
        nodes.sort((n1, n2) -> {
            ImageView a = (ImageView) n1;
            ImageView b = (ImageView) n2;
            String idA = a.getId();
            String idB = b.getId();
            int colorA = getColorOrder(cardColors.get(idA));
            int colorB = getColorOrder(cardColors.get(idB));
            if (colorA != colorB) {
                return Integer.compare(colorA, colorB);
            }
            int rankA = cardRanks.getOrDefault(idA, 0);
            int rankB = cardRanks.getOrDefault(idB, 0);
            return Integer.compare(rankB, rankA);
        });
        main.getChildren().setAll(nodes);
    }

    private int getColorOrder(String color) {
        color = normalizeColor(color);
        switch (color) {
            case "ATOUT":
            case "BOUT":
                return 0;
            case "PIQUE":
                return 1;
            case "COEUR":
                return 2;
            case "TREFLE":
                return 3;
            case "CARREAU":
                return 4;
            default:
                return 5;
        }
    }

    private String normalizeColor(String color) {
        if (color == null) return "";
        color = color.toUpperCase();
        switch (color) {
            case "SPADE":
            case "PIQUE":
                return "PIQUE";
            case "HEART":
            case "COEUR":
                return "COEUR";
            case "CLOVER":
            case "TREFLE":
                return "TREFLE";
            case "DIAMOND":
            case "CARREAU":
                return "CARREAU";
            case "BOUT":
                return "BOUT";
            case "ATOUT":
                return "ATOUT";
            default:
                return color;
        }
    }

    public void setPlayerNames(ArrayList<String> names) {
        this.playerNames = names;
        opponentLabels = List.of(labelLeft, labelTopLeft, labelTopRight, labelRight);
        opponentScoreLabels = List.of(scoreLeft, scoreTopLeft, scoreTopRight, scoreRight);
        int myNum = Integer.parseInt(AccueilController.numJoueur);
        baseStylesByPlayer.put(myNum, BASE_LABEL_STYLE);
        for (int i = 1; i <= 4; i++) {
            int playerNum = ((myNum + i - 1) % 5) + 1;
            Label lbl = opponentLabels.get(i - 1);
            lbl.setText(names.get(playerNum - 1));
            lbl.setStyle(BASE_LABEL_STYLE);
            labelsByPlayer.put(playerNum, lbl);
            baseStylesByPlayer.put(playerNum, BASE_LABEL_STYLE);
        }
    }

    public void startListener() {
        try {
            listener = new ServerListener(ConnexionController.host, ConnexionController.port, data -> {
                if (data.isEmpty()) return;
                String type = data.get(0).toString();
                switch (type) {
                    case "ANSWER_UPDATE":
                        handleAnswerUpdate(data.subList(1, data.size()));
                        break;
                    case "CALL_INFO":
                        handleCallInfo(data.subList(1, data.size()));
                        break;
                    case "DOG_READY":
                        startNextTurn();
                        break;
                    case "TOUR_UPDATE":
                        handleTourUpdate(data.subList(1, data.size()));
                        break;
                    case "KING_PLAYED":
                        handleKingPlayed(((Number) data.get(1)).intValue());
                        break;
                    default:
                        break;
                }
            });
            Thread t = new Thread(listener);
            t.setDaemon(true);
            t.start();

            ArrayList<Object> wait = new ArrayList<>();
            wait.add("WAITANSWER");
            try {
                ArrayList<Object> resp = ConnexionController.client.send(wait);
                handleAnswerUpdate(resp);
            } catch (IOException | ClassNotFoundException ex) {
                ex.printStackTrace();
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private void handleAnswerUpdate(List<Object> resp) {
        int current = (int) resp.get(0);
        String takeFlag = (String) resp.get(1);
        int numPlayerTake = (int) resp.get(2);
        String contract = resp.size() > 3 ? (String) resp.get(3) : "";
        contractBox.setVisible(false);
        if (takeFlag.equals("TAKE")) {
            takerNum = numPlayerTake;
            lastCurrentPlayer = numPlayerTake;
            updateCurrentPlayerLabel(numPlayerTake);
            String name = playerNames != null && numPlayerTake <= playerNames.size()
                    ? playerNames.get(numPlayerTake - 1)
                    : "Joueur " + numPlayerTake;
            String contractDisplay = contract.toLowerCase().replace('_', ' ');
            statusLabel.setText(name + " déclare une " + contractDisplay);
            take(numPlayerTake);
        } else {
            lastCurrentPlayer = current;
            updateCurrentPlayerLabel(current);
            if (current == Integer.parseInt(AccueilController.numJoueur)) {
                statusLabel.setText("A votre tour !");
                contractBox.setVisible(true);
            } else {
                String name = playerNames != null && current <= playerNames.size()
                        ? playerNames.get(current - 1)
                        : "Joueur " + current;
                statusLabel.setText("Au tour de " + name);
            }
        }
    }

    private void handleCallInfo(List<Object> resp) {
        calledKingColor = normalizeColor((String) resp.get(4));
        statusLabel.setText("Le Roi de " + resp.get(4) + " a été appelé !");
        boxChien.getChildren().clear();
        ArrayList<Integer> idCartes = (ArrayList<Integer>) resp.get(1);
        ArrayList<String> lienCartes = (ArrayList<String>) resp.get(2);
        for (int i = 0; i < idCartes.size(); i++) {
            InputStream is = getClass().getResourceAsStream("/sample/img/" + lienCartes.get(i));
            Image img = new Image(is != null ? is : getClass().getResourceAsStream("/sample/img/carte.png"));
            ImageView imageChien = new ImageView(img);
            applyCardSize(imageChien);
            boxChien.getChildren().add(imageChien);
        }
        carteCenter.setVisible(false);
        if (!pendingDogIds.isEmpty()) {
            retrieveDog.setVisible(true);
        }
        resizeAllCards();
    }

    private void handleTourUpdate(List<Object> resp) {
        int current = (int) resp.get(0);
        lastCurrentPlayer = current;
        boolean finTour = (boolean) resp.get(1);
        boolean finPartie = (boolean) resp.get(2);
        ArrayList<String> idCartes = (ArrayList<String>) resp.get(3);
        ArrayList<String> lienCartes = (ArrayList<String>) resp.get(4);
        String couleur = resp.size() > 5 ? normalizeColor((String) resp.get(5)) : "";
        ArrayList<Double> scores = resp.size() > 6 ? (ArrayList<Double>) resp.get(6) : null;
        lastScores = scores;
        boxTour.getChildren().clear();
        highestAtoutCenter = 0;
        for (int i = 0; i < idCartes.size(); i++) {
            InputStream is = getClass().getResourceAsStream("/sample/img/" + lienCartes.get(i));
            Image img = new Image(is != null ? is : getClass().getResourceAsStream("/sample/img/carte.png"));
            ImageView view = new ImageView(img);
            applyCardSize(view);
            boxTour.getChildren().add(view);
            if (lienCartes.get(i).contains("Atout")) {
                int r = extractRank(lienCartes.get(i));
                if (r > highestAtoutCenter) {
                    highestAtoutCenter = r;
                }
            }
        }
        resizeAllCards();
        updateCurrentPlayerLabel(current);
        int myNum = Integer.parseInt(AccueilController.numJoueur);
        if (scores != null && playerNames != null && scores.size() == playerNames.size()) {
            scoreSelf.setText(String.format("%.1f", scores.get(myNum - 1)));
            for (int i = 1; i <= 4; i++) {
                int playerNum = ((myNum + i - 1) % 5) + 1;
                opponentScoreLabels.get(i - 1).setText(String.format("%.1f", scores.get(playerNum - 1)));
            }
            if (partnerNum != -1) {
                updateTeamScores(scores);
            }
        }
        if (current == myNum && !finTour && !finPartie) {
            statusLabel.setText("Tour " + tourCount + " : A votre tour");
        } else if (finTour && !finPartie) {
            statusLabel.setText("Tour " + tourCount + " terminé");
            startNextTurn();
        } else if (finPartie) {
            statusLabel.setText("Fin de partie");
        } else {
            String name = playerNames != null && current <= playerNames.size()
                    ? playerNames.get(current - 1)
                    : "Joueur " + current;
            statusLabel.setText("Tour " + tourCount + " : Au tour de " + name);
        }
        updatePlayableCards(current, couleur);
    }

    private void updatePlayableCards(int current, String couleur) {
        int myNum = Integer.parseInt(AccueilController.numJoueur);
        if ("BOUT".equals(couleur)) {
            couleur = "ATOUT";
        }
        boolean isMyTurn = current == myNum;
        boolean hasColor = false;
        boolean hasAtout = false;
        boolean hasHigherAtout = false;
        if (isMyTurn && !couleur.isEmpty()) {
            for (int i = 0; i < main.getChildren().size(); i++) {
                ImageView img = (ImageView) main.getChildren().get(i);
                String id = img.getId();
                String color = cardColors.get(id);
                int r = cardRanks.getOrDefault(id, 0);
                String effective = "BOUT".equals(color) && r > 0 ? "ATOUT" : color;
                if (couleur.equals(effective)) {
                    hasColor = true;
                }
                if ("ATOUT".equals(effective)) {
                    hasAtout = true;
                    if (r > highestAtoutCenter) {
                        hasHigherAtout = true;
                    }
                }
            }
        }
        ColorAdjust gray = new ColorAdjust();
        gray.setSaturation(-1);
        gray.setBrightness(-0.3);
        for (int i = 0; i < main.getChildren().size(); i++) {
            ImageView imageCarte = (ImageView) main.getChildren().get(i);
            imageCarte.setOnMouseClicked(null);
            imageCarte.setOnMouseEntered(null);
            imageCarte.setOnMouseExited(null);
            imageCarte.setScaleX(1);
            imageCarte.setScaleY(1);
            imageCarte.setViewOrder(0);
            if (!isMyTurn) {
                imageCarte.setDisable(true);
                imageCarte.setEffect(gray);
                continue;
            }
            boolean disable = false;
            String id = imageCarte.getId();
            String color = cardColors.get(id);
            int rank = cardRanks.getOrDefault(id, 0);
            boolean isExcuse = "BOUT".equals(color) && rank == 0;
            String effective = "BOUT".equals(color) && rank > 0 ? "ATOUT" : color;
            if (isExcuse) {
                disable = tourCount >= 15;
            } else if (!couleur.isEmpty()) {
                if (hasColor) {
                    if (!couleur.equals(effective)) {
                        disable = true;
                    } else if ("ATOUT".equals(couleur) && highestAtoutCenter > 0 && hasHigherAtout && rank < highestAtoutCenter) {
                        disable = true;
                    }
                } else if (hasAtout) {
                    if (!"ATOUT".equals(effective)) {
                        disable = true;
                    } else if (highestAtoutCenter > 0 && hasHigherAtout && rank < highestAtoutCenter) {
                        disable = true;
                    }
                }
            }
            imageCarte.setDisable(disable);
            if (disable) {
                imageCarte.setEffect(gray);
                imageCarte.setCursor(Cursor.DEFAULT);
                continue;
            } else {
                imageCarte.setEffect(null);
            }
            int finalI = i;
            imageCarte.setOnMouseEntered(e -> {
                imageCarte.setScaleX(1.2);
                imageCarte.setScaleY(1.2);
                imageCarte.setViewOrder(-1);
                imageCarte.setCursor(Cursor.HAND);
            });
            imageCarte.setOnMouseExited(e -> {
                imageCarte.setScaleX(1);
                imageCarte.setScaleY(1);
                imageCarte.setViewOrder(0);
                imageCarte.setCursor(Cursor.DEFAULT);
            });
            imageCarte.setOnMouseClicked(e -> {
                ArrayList<Object> playTours = new ArrayList<>();
                playTours.add("PLAYTOUR");
                playTours.add(imageCarte.getId());
                playTours.add(ConnexionController.idUser);
                playTours.add(finalI + 1);
                ArrayList<Object> datas = null;
                try {
                    datas = ConnexionController.client.send(playTours);
                } catch (IOException | ClassNotFoundException ex) {
                    ex.printStackTrace();
                    return;
                }
                boolean hasError = (boolean) datas.get(0);
                if (!hasError) {
                    main.getChildren().remove(imageCarte);
                    disableAllCards();
                } else {
                    statusLabel.setText("Carte non valide !");
                }
            });
        }
    }

    private void disableAllCards() {
        ColorAdjust gray = new ColorAdjust();
        gray.setSaturation(-1);
        gray.setBrightness(-0.3);
        for (int i = 0; i < main.getChildren().size(); i++) {
            ImageView imageCarte = (ImageView) main.getChildren().get(i);
            imageCarte.setDisable(true);
            imageCarte.setEffect(gray);
            imageCarte.setCursor(Cursor.DEFAULT);
        }
    }

    private void updateCurrentPlayerLabel(int current) {
        for (Map.Entry<Integer, Label> e : labelsByPlayer.entrySet()) {
            int p = e.getKey();
            Label l = e.getValue();
            l.setStyle(baseStylesByPlayer.getOrDefault(p, BASE_LABEL_STYLE));
        }
        Label cur = labelsByPlayer.get(current);
        if (cur != null) {
            cur.setStyle(CURRENT_LABEL_STYLE);
        }
    }

    private void handleKingPlayed(int playerNum) {
        partnerNum = playerNum;
        updateTeamStyles();
        if (lastScores != null) {
            updateTeamScores(lastScores);
        }
        updateCurrentPlayerLabel(lastCurrentPlayer);
    }

    private void updateTeamStyles() {
        for (int p = 1; p <= 5; p++) {
            String style = (p == takerNum || p == partnerNum) ? ATTACK_LABEL_STYLE : DEFENSE_LABEL_STYLE;
            baseStylesByPlayer.put(p, style);
            Label lbl = labelsByPlayer.get(p);
            if (lbl != null) {
                lbl.setStyle(style);
            }
        }
        if (teamScoreBox != null) {
            teamScoreBox.setVisible(true);
        }
    }

    private void updateTeamScores(List<Double> scores) {
        if (takerNum == -1 || partnerNum == -1 || scores == null || scores.size() < 5) return;
        double attack = scores.get(takerNum - 1) + scores.get(partnerNum - 1);
        double defense = 0;
        for (double s : scores) defense += s;
        defense -= attack;
        attackScoreLabel.setText(String.format("%.1f", attack));
        defenseScoreLabel.setText(String.format("%.1f", defense));
    }

    private void sendContract(String type) {
        ArrayList<Object> msg = new ArrayList<>();
        msg.add("CHIEN");
        msg.add(type);
        msg.add(ConnexionController.idUser);
        try {
            ConnexionController.client.send(msg);
        } catch (IOException | ClassNotFoundException e) {
            e.printStackTrace();
        }
        contractBox.setVisible(false);
    }

    @FXML
    public void choosePetite() { sendContract("PETITE"); }

    @FXML
    public void chooseGarde() { sendContract("GARDE"); }

    @FXML
    public void chooseGardeContre() { sendContract("GARDE_CONTRE"); }

    @FXML
    public void chooseGardeSans() { sendContract("GARDE_SANS"); }

    @FXML
    public void chooseRefuse() {
        ArrayList<Object> refuses = new ArrayList<>();
        refuses.add("REFUSE");
        refuses.add(ConnexionController.idUser);
        try {
            ConnexionController.client.send(refuses);
        } catch (IOException | ClassNotFoundException e) {
            e.printStackTrace();
        }
        contractBox.setVisible(false);
    }

    public void take(int numPlayerTake) {
        if(numPlayerTake == Integer.parseInt(AccueilController.numJoueur)){
            carteCenter.setVisible(false);
            ArrayList<Object> rois = new ArrayList<>();
            rois.add("ROIS");
            rois.add(ConnexionController.idUser);
            ArrayList<Object> datas = null;
            try {
                datas = ConnexionController.client.send(rois);
            } catch (IOException | ClassNotFoundException e) {
                e.printStackTrace();
            }
            ArrayList<String> idCartes = (ArrayList<String>) datas.get(0);
            ArrayList<String> lienCartes = (ArrayList<String>) datas.get(1);
            boxRois.setSpacing(20);
            for(int i = 0; i < idCartes.size() ; i++) {
                    InputStream is = getClass().getResourceAsStream("/sample/img/" + lienCartes.get(i));
                    Image img = is != null ? new Image(is)
                                         : new Image(getClass().getResourceAsStream("/sample/img/carte.png"));
                    ImageView imageRoi = new ImageView(img);
                    applyCardSize(imageRoi);
                    int finalI = i;
                    imageRoi.setOnMouseEntered(e -> {
                        imageRoi.setScaleX(1.2);
                        imageRoi.setScaleY(1.2);
                        imageRoi.setCursor(Cursor.HAND);
                    });
                    imageRoi.setOnMouseExited(e -> {
                        imageRoi.setScaleX(1);
                        imageRoi.setScaleY(1);
                        imageRoi.setCursor(Cursor.DEFAULT);
                    });
                    imageRoi.addEventHandler(javafx.scene.input.MouseEvent.MOUSE_CLICKED, event -> {
                        callKing(idCartes.get(finalI));
                    });
                    boxRois.getChildren().add(imageRoi);
            }
            resizeAllCards();
        } else {
            ArrayList<Object> waitcalls = new ArrayList<>();
            waitcalls.add("WAITCALL");
            waitcalls.add(ConnexionController.idUser);
            try {
                ArrayList<Object> resp = ConnexionController.client.send(waitcalls);
                if ((boolean) resp.get(0)) {
                    handleCallInfo(resp);
                }
            } catch (IOException | ClassNotFoundException e) {
                e.printStackTrace();
            }
        }
    }
    public void callKing(String idCarte) {
        boxRois.getChildren().clear();
        boxRois.setSpacing(20);
        boxChien.setSpacing(20);
        ArrayList<Object> calls = new ArrayList<>();
        calls.add("CALL");
        calls.add(Integer.parseInt(idCarte));
        calls.add(ConnexionController.idUser);
        ArrayList<Object> datas2 = null;
        try {
            datas2 = ConnexionController.client.send(calls);
        } catch (IOException | ClassNotFoundException e) {
            e.printStackTrace();
            return;
        }
        ArrayList<Integer> idsTmp = (ArrayList<Integer>) datas2.get(0);
        pendingDogIds = new ArrayList<>();
        for (Integer i : idsTmp) {
            pendingDogIds.add(i.toString());
        }
        pendingDogLiens = (ArrayList<String>) datas2.get(1);
        pendingDogColors = (ArrayList<String>) datas2.get(2);
    }

    @FXML
    public void retrieveDogCards() {
        for (int j = 0; j < pendingDogIds.size(); j++) {
            InputStream is = getClass().getResourceAsStream("/sample/img/" + pendingDogLiens.get(j));
            Image img = new Image(is != null ? is : getClass().getResourceAsStream("/sample/img/carte.png"));
            ImageView handView = new ImageView(img);
            applyCardSize(handView);
            handView.setId(pendingDogIds.get(j));
            cardColors.put(pendingDogIds.get(j), normalizeColor(pendingDogColors.get(j)));
            cardRanks.put(pendingDogIds.get(j), extractRank(pendingDogLiens.get(j)));
            main.getChildren().add(handView);
        }
        sortHand();
        boxChien.getChildren().clear();
        retrieveDog.setVisible(false);
        enableDogSelection();
        resizeAllCards();
    }

    private void enableDogSelection() {
        ColorAdjust gray = new ColorAdjust();
        gray.setSaturation(-1);
        gray.setBrightness(-0.3);
        for (int i = 0; i < main.getChildren().size(); i++) {
            ImageView imageCarte = (ImageView) main.getChildren().get(i);
            String id = imageCarte.getId();
            String color = cardColors.get(id);
            int rank = cardRanks.getOrDefault(id, 0);
            boolean isBout = "BOUT".equals(color);
            boolean isKing = rank == 14 && !"ATOUT".equals(color);
            if (isBout || isKing) {
                imageCarte.setDisable(true);
                imageCarte.setEffect(gray);
                continue;
            }
            imageCarte.setOnMouseEntered(e -> {
                imageCarte.setScaleX(1.2);
                imageCarte.setScaleY(1.2);
                imageCarte.setViewOrder(-1);
                imageCarte.setCursor(Cursor.HAND);
            });
            imageCarte.setOnMouseExited(e -> {
                imageCarte.setScaleX(1);
                imageCarte.setScaleY(1);
                imageCarte.setViewOrder(0);
                imageCarte.setCursor(Cursor.DEFAULT);
            });
            imageCarte.setOnMouseClicked((e) -> {
                ArrayList<Object> addDogs = new ArrayList<>();
                addDogs.add("ADDDOG");
                addDogs.add(imageCarte.getId());
                ArrayList<Object> datas3 = null;
                try {
                    datas3 = ConnexionController.client.send(addDogs);
                } catch (IOException | ClassNotFoundException ex) {
                    ex.printStackTrace();
                }
                boolean dogDone = (boolean) datas3.get(0);
                String ok = (String) datas3.get(1);

                if(ok.equals("OK")) {
                    main.getChildren().remove(imageCarte);
                    ImageView dogCard = new ImageView(imageCarte.getImage());
                    applyCardSize(dogCard);
                    boxChien.getChildren().add(dogCard);
                    resizeAllCards();
                    if(dogDone) {
                        for (int j = 0; j < main.getChildren().size(); j++) {
                            ImageView imageCarte1 = (ImageView) main.getChildren().get(j);
                            imageCarte1.setDisable(true);
                        }
                    }
                }
                else {
                    statusLabel.setText("Mauvaise carte dans le chien !");
                }

            });
        }
    }


    private void requestCurrentTour() {
        ArrayList<Object> waitTours = new ArrayList<>();
        waitTours.add("WAITTOUR");
        try {
            ArrayList<Object> resp = ConnexionController.client.send(waitTours);
            handleTourUpdate(resp);
        } catch (IOException | ClassNotFoundException e) {
            e.printStackTrace();
        }
    }

    private void startNextTurn() {
        if (sendingTurn) return;
        sendingTurn = true;
        boxChien.getChildren().clear();
        boxTour.getChildren().clear();
        tourCount++;
        ArrayList<Object> begins = new ArrayList<>();
        begins.add("BEGIN");
        try {
            ConnexionController.client.send(begins);
        } catch (IOException | ClassNotFoundException e) {
            e.printStackTrace();
        }
        requestCurrentTour();
        sendingTurn = false;
    }


}
